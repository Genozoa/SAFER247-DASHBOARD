import argparse
import os
import sys

from sqlalchemy import select

from app.auth.security import (
    hash_password,
    password_policy_errors,
    verify_password,
)
from app.db.models import Operator
from app.db.session import create_session_factory, get_engine


def seed_demo_operator(
    call_sign: str,
    password: str,
) -> bool:
    errors = password_policy_errors(password)
    if errors:
        raise ValueError("Demo password must contain " + ", ".join(errors) + ".")
    factory = create_session_factory(get_engine())
    with factory() as db:
        existing = db.scalar(select(Operator).where(Operator.username == call_sign))
        if existing is not None:
            if verify_password(password, existing.password_hash):
                return False
            raise ValueError("The configured demo call sign belongs to a different account.")

        operator = Operator(
            username=call_sign,
            password_hash=hash_password(password),
        )
        db.add(operator)
        db.commit()
        return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create the configured demo operator account."
    )
    parser.add_argument(
        "--confirm-demo-seed",
        action="store_true",
        help="Confirm that this development demo operator should be created.",
    )
    args = parser.parse_args()
    if not args.confirm_demo_seed:
        parser.error("Pass --confirm-demo-seed to opt in to creating the demo account.")
    if os.environ.get("APP_ENV", "development").lower() == "production":
        parser.error("Demo operators cannot be seeded in production.")

    call_sign = os.environ.get("DEMO_OPERATOR_CALL_SIGN", "").strip()
    password = os.environ.get("DEMO_OPERATOR_PASSWORD", "")
    if call_sign and call_sign != "Demo":
        parser.error("Set DEMO_OPERATOR_CALL_SIGN=Demo for the isolated sample dataset.")
    if not call_sign or not password:
        parser.error(
            "Set DEMO_OPERATOR_CALL_SIGN and DEMO_OPERATOR_PASSWORD first."
        )
    try:
        created = seed_demo_operator(call_sign, password)
    except (ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print("Demo operator created." if created else "Demo operator already exists.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
