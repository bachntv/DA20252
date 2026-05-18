from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from typing import Dict, Any
import psycopg2
import os
import csv
import io
import uuid
from dotenv import load_dotenv
from .auth_routes import get_current_admin_user

load_dotenv("backend/.env")

router = APIRouter(dependencies=[Depends(get_current_admin_user)])

def get_conn():
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DATABASE"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT")
    )


def csv_response(filename: str, rows: list[dict[str, Any]]):
    output = io.StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    if rows:
        writer.writerows(rows)
    else:
        writer.writerow({"message": "No data"})
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def normalize_sort(value: str, allowed: dict[str, str], default: str):
    return allowed.get(value, default)


def create_notification(cur, user_id: str | None, event_type: str, title: str, message: str):
    cur.execute(
        """
        INSERT INTO public.notification_logs (id, user_id, event_type, channel, title, message, status, is_read, created_at)
        VALUES (%s, %s, %s, 'internal', %s, %s, 'created', FALSE, NOW())
        """,
        (str(uuid.uuid4()), user_id, event_type, title, message),
    )

@router.get("/tables")
def get_tables():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        return tables
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}/schema")
def get_table_schema(table_name: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT a.attname, format_type(a.atttypid, a.atttypmod),
                   (i.indisprimary IS TRUE) AS is_primary
            FROM   pg_attribute a
            LEFT JOIN pg_index i ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE  a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
        """, (table_name,))
        schema = [
            {"name": row[0], "type": row[1], "is_primary": row[2]} for row in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}")
def read_table(table_name: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'SELECT * FROM "{table_name}" LIMIT 100')
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tables/{table_name}")
def create_row(table_name: str, row: Dict[str, Any]):
    try:
        conn = get_conn()
        cur = conn.cursor()
        keys = ', '.join([f'"{k}"' for k in row.keys()])
        placeholders = ', '.join([f'%({k})s' for k in row.keys()])
        query = f'INSERT INTO "{table_name}" ({keys}) VALUES ({placeholders})'
        cur.execute(query, row)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tables/{table_name}/{pk}")
def update_row(table_name: str, pk: str, row: Dict[str, Any]):
    try:
        pk_name = get_primary_key(table_name)

        # Remove the PK from update values
        values = {k: v for k, v in row.items() if k != pk_name}

        if not values:
            raise HTTPException(status_code=400, detail="No fields to update")

        assignments = ', '.join([f'"{k}" = %({k})s' for k in values.keys()])
        query = f'UPDATE "{table_name}" SET {assignments} WHERE "{pk_name}" = %(pk)s'

        values['pk'] = pk  # only for WHERE clause
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(query, values)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "updated"}
    except Exception as e:
        print("❌ Update error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tables/{table_name}/{pk}")
def delete_row(table_name: str, pk: str):
    try:
        pk_name = get_primary_key(table_name)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'DELETE FROM "{table_name}" WHERE "{pk_name}" = %s', (pk,))
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/overview")
def get_overview():
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        tables = [row[0] for row in cur.fetchall()]

        overview = {}
        for table in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
                count = cur.fetchone()[0]
                overview[table] = count
            except Exception as table_err:
                overview[table] = f"Error: {str(table_err)}"  

        cur.close()
        conn.close()
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Overview failed: {str(e)}")


@router.get("/dashboard-metrics")
def get_dashboard_metrics():
    try:
        conn = get_conn()
        cur = conn.cursor()

        metrics = {}
        cur.execute('SELECT COUNT(*) FROM public."users"')
        metrics["total_users"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.users WHERE account_type = 'free'")
        metrics["free_users"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.users WHERE account_type = 'premium'")
        metrics["premium_users"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active'")
        metrics["active_subscriptions"] = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*)
            FROM public.subscriptions
            WHERE status = 'active'
              AND expires_at IS NOT NULL
              AND expires_at <= NOW() + INTERVAL '7 days'
        """)
        metrics["expiring_subscriptions"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.payments")
        total_payments = cur.fetchone()[0]
        metrics["total_payments"] = total_payments

        cur.execute("SELECT COUNT(*) FROM public.payments WHERE status = 'paid'")
        paid_payments = cur.fetchone()[0]
        metrics["paid_payments"] = paid_payments

        cur.execute("SELECT COUNT(*) FROM public.payments WHERE status = 'pending'")
        pending_payments = cur.fetchone()[0]
        metrics["pending_payments"] = pending_payments

        cur.execute("SELECT COUNT(*) FROM public.payments WHERE status = 'failed'")
        failed_payments = cur.fetchone()[0]
        metrics["failed_payments"] = failed_payments

        denominator = total_payments or 1
        metrics["payment_success_rate"] = round((paid_payments / denominator) * 100, 1)
        metrics["payment_pending_rate"] = round((pending_payments / denominator) * 100, 1)
        metrics["payment_failed_rate"] = round((failed_payments / denominator) * 100, 1)

        cur.execute("SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'paid'")
        metrics["total_revenue"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.playlists")
        metrics["total_playlists"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.songs")
        metrics["total_songs"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.songs WHERE is_active = TRUE")
        metrics["active_songs"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.songs WHERE is_active = FALSE")
        metrics["inactive_songs"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.albums WHERE is_active = TRUE")
        metrics["active_albums"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.albums WHERE is_active = FALSE")
        metrics["inactive_albums"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.artists WHERE is_active = TRUE")
        metrics["active_artists"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.artists WHERE is_active = FALSE")
        metrics["inactive_artists"] = cur.fetchone()[0]

        cur.close()
        conn.close()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard metrics failed: {str(e)}")


@router.get("/activity-logs")
def get_recent_activity_logs():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at, u.username
            FROM public.activity_logs a
            LEFT JOIN public.users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT 20
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [
            {
                "id": row[0],
                "action": row[1],
                "target_type": row[2],
                "target_id": row[3],
                "details": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "username": row[6],
            }
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Activity logs failed: {str(e)}")


@router.get("/top-songs")
def get_top_songs(
    period: str = Query("all", pattern="^(all|week|month)$"),
    search: str = Query("", max_length=120),
    sort: str = Query("plays_desc", pattern="^(plays_desc|plays_asc|track_asc|track_desc)$"),
    limit: int = Query(10, ge=1, le=500),
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        where_parts = []
        params = []
        if period == "week":
            where_parts.append("lh.played_at >= NOW() - INTERVAL '7 days'")
        elif period == "month":
            where_parts.append("lh.played_at >= NOW() - INTERVAL '30 days'")
        if search:
            where_parts.append("(LOWER(s.track_name) LIKE %s OR LOWER(at.name) LIKE %s)")
            search_value = f"%{search.lower()}%"
            params.extend([search_value, search_value])
        filter_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        order_sql = normalize_sort(sort, {
            "plays_desc": "play_count DESC, s.track_name ASC",
            "plays_asc": "play_count ASC, s.track_name ASC",
            "track_asc": "s.track_name ASC",
            "track_desc": "s.track_name DESC",
        }, "play_count DESC, s.track_name ASC")
        params.append(limit)
        cur.execute(f"""
            SELECT s.track_name, at.name AS artist_name, COUNT(*) AS play_count
            FROM public.listening_history lh
            JOIN public.songs s ON s.track_id = lh.track_id
            JOIN public.artists at ON at.id = s.artist_id
            {filter_sql}
            GROUP BY s.track_name, at.name
            ORDER BY {order_sql}
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "period": period,
            "search": search,
            "sort": sort,
            "items": [
            {
                "rank": index + 1,
                "track_name": row[0],
                "artist_name": row[1],
                "play_count": row[2],
            }
                for index, row in enumerate(rows)
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Top songs failed: {str(e)}")


@router.get("/top-users")
def get_top_users(
    period: str = Query("all", pattern="^(all|week|month)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", pattern="^(all|free|premium)$"),
    sort: str = Query("plays_desc", pattern="^(plays_desc|plays_asc|username_asc|username_desc|plan_asc|plan_desc)$"),
    limit: int = Query(10, ge=1, le=500),
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        where_parts = []
        params = []
        if period == "week":
            where_parts.append("lh.played_at >= NOW() - INTERVAL '7 days'")
        elif period == "month":
            where_parts.append("lh.played_at >= NOW() - INTERVAL '30 days'")
        if search:
            where_parts.append("LOWER(u.username) LIKE %s")
            params.append(f"%{search.lower()}%")
        if plan != "all":
            where_parts.append("u.account_type = %s")
            params.append(plan)
        filter_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        order_sql = normalize_sort(sort, {
            "plays_desc": "play_count DESC, u.username ASC",
            "plays_asc": "play_count ASC, u.username ASC",
            "username_asc": "u.username ASC",
            "username_desc": "u.username DESC",
            "plan_asc": "u.account_type ASC, u.username ASC",
            "plan_desc": "u.account_type DESC, u.username ASC",
        }, "play_count DESC, u.username ASC")
        params.append(limit)
        cur.execute(f"""
            SELECT u.username, u.account_type, COUNT(*) AS play_count
            FROM public.listening_history lh
            JOIN public.users u ON u.id = lh.user_id
            {filter_sql}
            GROUP BY u.username, u.account_type
            ORDER BY {order_sql}
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "period": period,
            "search": search,
            "plan": plan,
            "sort": sort,
            "items": [
            {
                "rank": index + 1,
                "username": row[0],
                "account_type": row[1],
                "play_count": row[2],
            }
                for index, row in enumerate(rows)
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Top users failed: {str(e)}")


@router.get("/payments-report")
def get_payments_report(
    status: str = Query("all", pattern="^(all|pending|paid|failed)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", max_length=60),
    sort: str = Query("created_desc", pattern="^(created_desc|created_asc|amount_desc|amount_asc|status_asc|status_desc)$"),
    limit: int = Query(100, ge=1, le=500),
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        params = []
        where_parts = []
        if status != "all":
            where_parts.append("p.status = %s")
            params.append(status)
        if search:
            where_parts.append("(LOWER(u.username) LIKE %s OR LOWER(COALESCE(p.note, '')) LIKE %s)")
            search_value = f"%{search.lower()}%"
            params.extend([search_value, search_value])
        if plan != "all":
            where_parts.append("(LOWER(pl.code) = %s OR LOWER(pl.name) = %s)")
            plan_value = plan.lower()
            params.extend([plan_value, plan_value])
        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        order_sql = normalize_sort(sort, {
            "created_desc": "p.created_at DESC",
            "created_asc": "p.created_at ASC",
            "amount_desc": "p.amount DESC, p.created_at DESC",
            "amount_asc": "p.amount ASC, p.created_at DESC",
            "status_asc": "p.status ASC, p.created_at DESC",
            "status_desc": "p.status DESC, p.created_at DESC",
        }, "p.created_at DESC")
        params.append(limit)

        cur.execute(f"""
            SELECT
                p.id,
                u.username,
                pl.name,
                p.amount,
                p.currency,
                p.provider,
                p.status,
                p.note,
                p.created_at,
                p.updated_at
            FROM public.payments p
            LEFT JOIN public.users u ON u.id = p.user_id
            LEFT JOIN public.plans pl ON pl.id = p.plan_id
            {where_clause}
            ORDER BY {order_sql}
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "status": status,
            "search": search,
            "plan": plan,
            "sort": sort,
            "items": [
                {
                    "id": row[0],
                    "username": row[1],
                    "plan_name": row[2],
                    "amount": row[3],
                    "currency": row[4],
                    "provider": row[5],
                    "status": row[6],
                    "note": row[7],
                    "created_at": row[8].isoformat() if row[8] else None,
                    "updated_at": row[9].isoformat() if row[9] else None,
                }
                for row in rows
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payments report failed: {str(e)}")


@router.get("/revenue-summary")
def get_revenue_summary():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM public.payments
            WHERE status = 'paid'
        """)
        all_revenue = cur.fetchone()[0]

        cur.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM public.payments
            WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '7 days'
        """)
        week_revenue = cur.fetchone()[0]

        cur.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM public.payments
            WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '30 days'
        """)
        month_revenue = cur.fetchone()[0]

        cur.execute("""
            SELECT status, COUNT(*)
            FROM public.payments
            GROUP BY status
        """)
        status_rows = cur.fetchall()
        cur.close()
        conn.close()

        status_map = {"pending": 0, "paid": 0, "failed": 0}
        for row in status_rows:
            if row[0] in status_map:
                status_map[row[0]] = row[1]

        return {
            "revenue": {
                "all": all_revenue,
                "week": week_revenue,
                "month": month_revenue,
            },
            "payments_by_status": status_map,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Revenue summary failed: {str(e)}")


@router.get("/revenue-history")
def get_revenue_history():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_key,
                COALESCE(SUM(amount), 0) AS revenue
            FROM public.payments
            WHERE status = 'paid'
              AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM')
            ORDER BY DATE_TRUNC('month', created_at) ASC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "items": [
                {
                    "month": row[0],
                    "revenue": row[1],
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Revenue history failed: {str(e)}")


@router.get("/top-songs/export")
def export_top_songs(
    period: str = Query("all", pattern="^(all|week|month)$"),
    search: str = Query("", max_length=120),
    sort: str = Query("plays_desc", pattern="^(plays_desc|plays_asc|track_asc|track_desc)$"),
):
    payload = get_top_songs(period=period, search=search, sort=sort, limit=500)
    return csv_response(f"top-songs-{period}.csv", payload["items"])


@router.get("/top-users/export")
def export_top_users(
    period: str = Query("all", pattern="^(all|week|month)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", pattern="^(all|free|premium)$"),
    sort: str = Query("plays_desc", pattern="^(plays_desc|plays_asc|username_asc|username_desc|plan_asc|plan_desc)$"),
):
    payload = get_top_users(period=period, search=search, plan=plan, sort=sort, limit=500)
    return csv_response(f"top-users-{period}.csv", payload["items"])


@router.get("/payments-report/export")
def export_payments_report(
    status: str = Query("all", pattern="^(all|pending|paid|failed)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", max_length=60),
    sort: str = Query("created_desc", pattern="^(created_desc|created_asc|amount_desc|amount_asc|status_asc|status_desc)$"),
):
    payload = get_payments_report(status=status, search=search, plan=plan, sort=sort, limit=500)
    return csv_response(f"payments-{status}.csv", payload["items"])


@router.get("/subscriptions-report/export")
def export_subscriptions_report(
    status: str = Query("all", pattern="^(all|active|pending_payment|cancelled|expired)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", max_length=60),
    expiring_days: int = Query(0, ge=0, le=365),
    sort: str = Query("updated_desc", pattern="^(updated_desc|updated_asc|expires_desc|expires_asc|username_asc|username_desc|status_asc|status_desc)$"),
):
    payload = get_subscriptions_report(
        status=status,
        search=search,
        plan=plan,
        expiring_days=expiring_days,
        sort=sort,
        limit=500,
    )
    return csv_response(f"subscriptions-{status}.csv", payload["items"])


@router.get("/subscriptions-report")
def get_subscriptions_report(
    status: str = Query("all", pattern="^(all|active|pending_payment|cancelled|expired)$"),
    search: str = Query("", max_length=120),
    plan: str = Query("all", max_length=60),
    expiring_days: int = Query(0, ge=0, le=365),
    sort: str = Query("updated_desc", pattern="^(updated_desc|updated_asc|expires_desc|expires_asc|username_asc|username_desc|status_asc|status_desc)$"),
    limit: int = Query(100, ge=1, le=500),
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        params = []
        where_parts = []
        if status != "all":
            where_parts.append("s.status = %s")
            params.append(status)
        if search:
            where_parts.append("LOWER(u.username) LIKE %s")
            params.append(f"%{search.lower()}%")
        if plan != "all":
            where_parts.append("(LOWER(p.code) = %s OR LOWER(p.name) = %s)")
            plan_value = plan.lower()
            params.extend([plan_value, plan_value])
        if expiring_days:
            where_parts.append("s.expires_at IS NOT NULL AND s.expires_at <= NOW() + (%s || ' days')::interval")
            params.append(expiring_days)
        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        order_sql = normalize_sort(sort, {
            "updated_desc": "s.updated_at DESC",
            "updated_asc": "s.updated_at ASC",
            "expires_desc": "s.expires_at DESC NULLS LAST",
            "expires_asc": "s.expires_at ASC NULLS LAST",
            "username_asc": "u.username ASC",
            "username_desc": "u.username DESC",
            "status_asc": "s.status ASC, s.updated_at DESC",
            "status_desc": "s.status DESC, s.updated_at DESC",
        }, "s.updated_at DESC")
        params.append(limit)

        cur.execute(f"""
            SELECT
                s.id,
                u.username,
                p.name,
                p.code,
                s.status,
                s.auto_renew,
                s.started_at,
                s.expires_at,
                s.updated_at
            FROM public.subscriptions s
            LEFT JOIN public.users u ON u.id = s.user_id
            LEFT JOIN public.plans p ON p.id = s.plan_id
            {where_clause}
            ORDER BY {order_sql}
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "status": status,
            "search": search,
            "plan": plan,
            "expiring_days": expiring_days,
            "sort": sort,
            "items": [
                {
                    "id": row[0],
                    "username": row[1],
                    "plan_name": row[2],
                    "plan_code": row[3],
                    "status": row[4],
                    "auto_renew": row[5],
                    "started_at": row[6].isoformat() if row[6] else None,
                    "expires_at": row[7].isoformat() if row[7] else None,
                    "updated_at": row[8].isoformat() if row[8] else None,
                }
                for row in rows
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subscriptions report failed: {str(e)}")


@router.get("/subscription-alerts")
def get_subscription_alerts():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                u.username,
                u.email,
                p.name,
                s.expires_at
            FROM public.subscriptions s
            JOIN public.users u ON u.id = s.user_id
            JOIN public.plans p ON p.id = s.plan_id
            WHERE s.status = 'active'
              AND s.expires_at IS NOT NULL
              AND s.expires_at <= NOW() + INTERVAL '7 days'
            ORDER BY s.expires_at ASC
            LIMIT 20
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "items": [
                {
                    "username": row[0],
                    "email": row[1],
                    "plan_name": row[2],
                    "expires_at": row[3].isoformat() if row[3] else None,
                    "notification_preview": f"[Mock email] Dear {row[0]}, your {row[2]} subscription will expire soon. Please renew to keep Premium access."
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subscription alerts failed: {str(e)}")


@router.get("/notification-logs")
def get_notification_logs(
    event_type: str = Query("all", max_length=80),
    search: str = Query("", max_length=120),
    limit: int = Query(100, ge=1, le=500),
):
    try:
        conn = get_conn()
        cur = conn.cursor()
        where_parts = []
        params = []
        if event_type != "all":
            where_parts.append("n.event_type = %s")
            params.append(event_type)
        if search:
            where_parts.append("(LOWER(u.username) LIKE %s OR LOWER(n.title) LIKE %s OR LOWER(n.message) LIKE %s)")
            search_value = f"%{search.lower()}%"
            params.extend([search_value, search_value, search_value])
        where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        params.append(limit)

        cur.execute(f"""
            SELECT n.id, n.event_type, n.channel, n.title, n.message, n.status, n.is_read, n.created_at, u.username
            FROM public.notification_logs n
            LEFT JOIN public.users u ON u.id = n.user_id
            {where_clause}
            ORDER BY n.created_at DESC
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "items": [
                {
                    "id": row[0],
                    "event_type": row[1],
                    "channel": row[2],
                    "title": row[3],
                    "message": row[4],
                    "status": row[5],
                    "is_read": row[6],
                    "created_at": row[7].isoformat() if row[7] else None,
                    "username": row[8],
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Notification logs failed: {str(e)}")


@router.post("/subscriptions/{subscription_id}/renew")
def admin_renew_subscription(subscription_id: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT s.user_id, s.plan_id, p.name, p.price_monthly
            FROM public.subscriptions s
            JOIN public.plans p ON p.id = s.plan_id
            WHERE s.id = %s
        """, (subscription_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        user_id, plan_id, plan_name, amount = row
        cur.execute("""
            UPDATE public.subscriptions
            SET status = 'active',
                auto_renew = TRUE,
                expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + INTERVAL '30 days',
                updated_at = NOW()
            WHERE id = %s
        """, (subscription_id,))
        cur.execute("""
            INSERT INTO public.payments (id, user_id, subscription_id, plan_id, amount, currency, provider, status, note, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'VND', 'admin', 'paid', %s, NOW(), NOW())
        """, (str(uuid.uuid4()), user_id, subscription_id, plan_id, amount, f"Admin renewal for {plan_name}"))
        create_notification(cur, user_id, "admin_renew", "Subscription renewed by admin", f"{plan_name} was renewed for 30 more days.")
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "renewed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Admin renewal failed: {str(e)}")


@router.post("/subscriptions/{subscription_id}/cancel")
def admin_cancel_subscription(subscription_id: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT user_id FROM public.subscriptions WHERE id = %s", (subscription_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        user_id = row[0]
        cur.execute("""
            UPDATE public.subscriptions
            SET status = 'cancelled', auto_renew = FALSE, updated_at = NOW()
            WHERE id = %s
        """, (subscription_id,))
        create_notification(cur, user_id, "admin_cancel", "Subscription cancelled by admin", "An admin cancelled this subscription.")
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Admin cancellation failed: {str(e)}")


@router.post("/subscriptions/{subscription_id}/toggle-auto-renew")
def admin_toggle_auto_renew(subscription_id: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            UPDATE public.subscriptions
            SET auto_renew = NOT auto_renew, updated_at = NOW()
            WHERE id = %s
            RETURNING user_id, auto_renew
        """, (subscription_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        user_id, auto_renew = row
        create_notification(
            cur,
            user_id,
            "admin_auto_renew_toggle",
            "Auto-renew setting changed",
            f"Auto-renew was {'enabled' if auto_renew else 'disabled'} by admin.",
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "updated", "auto_renew": auto_renew}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-renew update failed: {str(e)}")



def get_primary_key(table_name: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.attname
        FROM   pg_index i
        JOIN   pg_attribute a ON a.attrelid = i.indrelid
                             AND a.attnum = ANY(i.indkey)
        WHERE  i.indrelid = %s::regclass
        AND    i.indisprimary;
    """, (table_name,))
    result = cur.fetchone()
    cur.close()
    conn.close()
    if not result:
        raise HTTPException(status_code=400, detail="No primary key defined")
    return result[0]

