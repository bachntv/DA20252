from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any
import psycopg2
import os
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

        cur.execute("SELECT COUNT(*) FROM public.payments")
        metrics["total_payments"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.payments WHERE status = 'pending'")
        metrics["pending_payments"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM public.payments WHERE status = 'failed'")
        metrics["failed_payments"] = cur.fetchone()[0]

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
def get_top_songs(period: str = Query("all", pattern="^(all|week|month)$")):
    try:
        conn = get_conn()
        cur = conn.cursor()
        period_filters = {
            "all": "",
            "week": "WHERE lh.played_at >= NOW() - INTERVAL '7 days'",
            "month": "WHERE lh.played_at >= NOW() - INTERVAL '30 days'",
        }
        filter_sql = period_filters.get(period, "")
        cur.execute(f"""
            SELECT s.track_name, at.name AS artist_name, COUNT(*) AS play_count
            FROM public.listening_history lh
            JOIN public.songs s ON s.track_id = lh.track_id
            JOIN public.artists at ON at.id = s.artist_id
            {filter_sql}
            GROUP BY s.track_name, at.name
            ORDER BY play_count DESC, s.track_name ASC
            LIMIT 10
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "period": period,
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
def get_top_users(period: str = Query("all", pattern="^(all|week|month)$")):
    try:
        conn = get_conn()
        cur = conn.cursor()
        period_filters = {
            "all": "",
            "week": "WHERE lh.played_at >= NOW() - INTERVAL '7 days'",
            "month": "WHERE lh.played_at >= NOW() - INTERVAL '30 days'",
        }
        filter_sql = period_filters.get(period, "")
        cur.execute(f"""
            SELECT u.username, u.account_type, COUNT(*) AS play_count
            FROM public.listening_history lh
            JOIN public.users u ON u.id = lh.user_id
            {filter_sql}
            GROUP BY u.username, u.account_type
            ORDER BY play_count DESC, u.username ASC
            LIMIT 10
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "period": period,
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
def get_payments_report(status: str = Query("all", pattern="^(all|pending|paid|failed)$")):
    try:
        conn = get_conn()
        cur = conn.cursor()
        where_clause = ""
        params = []
        if status != "all":
            where_clause = 'WHERE p.status = %s'
            params.append(status)

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
            ORDER BY p.created_at DESC
            LIMIT 100
        """, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return {
            "status": status,
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

