import psycopg2
import uuid
from passlib.context import CryptContext

# Configuration - adjust DB creds if needed
DB_CONFIG = dict(dbname="music_streaming", user="postgres", password="postgres", host="localhost", port=5432)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(pw: str) -> str:
  return pwd_context.hash(pw)

def ensure_admin(username: str = "admin", password: str = "admin", email: str = "admin@local", birthdate: str = "1970-01-01"):
  conn = psycopg2.connect(**DB_CONFIG)
  cur = conn.cursor()

  # Check if a user with this username or email exists
  cur.execute("SELECT id, roles FROM users WHERE username = %s OR email = %s", (username, email))
  row = cur.fetchone()

  if row:
    # update roles to include admin if missing
    cur.execute("""
    UPDATE users
    SET roles = CASE
      WHEN roles IS NULL OR roles = '' THEN 'admin'
      WHEN roles ~* '\\badmin\\b' THEN roles
      ELSE roles || ',admin'
    END
    WHERE id = %s
    """, (row[0],))
    conn.commit()
    print(f"Updated roles for existing user '{username}' (id={row[0]})")
  else:
    # insert new admin user
    new_id = str(uuid.uuid4())
    hashed = hash_password(password)
    cur.execute(
      """
      INSERT INTO users (id, username, email, hashed_password, birthdate, gender, roles)
      VALUES (%s, %s, %s, %s, %s, %s, %s)
      """,
      (new_id, username, email, hashed, birthdate, None, 'admin')
    )
    conn.commit()
    print(f"Inserted new admin user '{username}' with id {new_id}")

  cur.close()
  conn.close()

if __name__ == '__main__':
  ensure_admin()