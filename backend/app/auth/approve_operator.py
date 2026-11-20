"""Trusted developer CLI to approve LDRRMO accounts."""
import argparse
import getpass
import hmac
import os
from datetime import datetime, timezone
from sqlalchemy import select
from app.config import load_environment
from app.db.models import Operator
from app.db.session import session_scope

def main():
    load_environment()
    parser = argparse.ArgumentParser()
    parser.add_argument("call_sign")
    parser.add_argument("--role", choices=("viewer", "operator", "admin"), default="operator")
    args = parser.parse_args()
    code = os.environ.get("OPERATOR_REGISTRATION_CODE", "")
    if not code:
        parser.error("OPERATOR_REGISTRATION_CODE is not configured.")
    if not hmac.compare_digest(code.encode(), getpass.getpass("Developer registration code: ").encode()):
        parser.error("Invalid developer registration code.")
    with session_scope() as db:
        operator = db.scalar(select(Operator).where(Operator.username == args.call_sign))
        if operator is None:
            parser.error("Operator not found.")
        operator.is_approved = True
        operator.approved_at = datetime.now(timezone.utc)
        operator.role = args.role
    print("Account approved.")

if __name__ == "__main__":
    main()
