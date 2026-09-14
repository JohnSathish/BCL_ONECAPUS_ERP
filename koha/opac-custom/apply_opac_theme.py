"""Load Don Bosco OPAC/staff theme into Koha MySQL (additional contents + UserJS)."""
from __future__ import annotations

import os
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
DB_NAME = os.environ.get("KOHA_DB_NAME", "koha_library")
DB_ROOT = os.environ.get("KOHA_DB_ROOT_PASSWORD", "koha_local_root")
MYSQL = [
    "docker",
    "exec",
    "-i",
    "koha-db",
    "mysql",
    "-uroot",
    f"-p{DB_ROOT}",
    DB_NAME,
]


def sql_str(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''")


def run_sql(sql: str) -> None:
    subprocess.run(MYSQL, input=sql.encode("utf-8"), check=True)


def mysql_value(sql: str) -> str:
    r = subprocess.run(MYSQL + ["-N", "-e", sql], capture_output=True, check=True)
    return r.stdout.decode("utf-8", "replace").strip().splitlines()[-1]


def apply_staff() -> None:
    items = mysql_value("SELECT COUNT(*) FROM items")
    patrons = mysql_value("SELECT COUNT(*) FROM borrowers")
    onloan = mysql_value("SELECT COUNT(*) FROM issues")
    overdue = mysql_value("SELECT COUNT(*) FROM issues WHERE date_due < NOW()")
    serials = mysql_value("SELECT COUNT(*) FROM subscription")
    aq = mysql_value("SELECT COUNT(*) FROM aqorders")
    holds = mysql_value("SELECT COUNT(*) FROM reserves")
    today_out = mysql_value(
        "SELECT COUNT(*) FROM statistics WHERE DATE(datetime)=CURDATE() AND type='issue'"
    )
    today_in = mysql_value(
        "SELECT COUNT(*) FROM statistics WHERE DATE(datetime)=CURDATE() AND type='return'"
    )
    (ROOT / "staff-stats.js").write_text(
        "window.DBC_STAFF_STATS="
        + f"{{items:{items},patrons:{patrons},onloan:{onloan},overdue:{overdue},"
        + f"serials:{serials},aq:{aq},holds:{holds},todayOut:{today_out},todayIn:{today_in}}};\n",
        encoding="utf-8",
    )
    loader = (ROOT / "staff-loader.js").read_text(encoding="utf-8")
    run_sql(
        "UPDATE systempreferences SET value='' WHERE variable='IntranetUserCSS';\n"
        f"UPDATE systempreferences SET value='{sql_str(loader)}' WHERE variable='IntranetUserJS';\n"
    )
    run_sql(
        """
UPDATE additional_contents_localizations
SET content='The college library has a collection of 26,558 volumes and 15 journals. The reading room of 1300 sq. ft., with its atmosphere of peace and quiet, is an invitation to staff and students to enrich themselves by seeking information, knowledge and wisdom. The library offers additional services like Photostat, Internet, Question and Answer Banks.'
WHERE additional_content_id=1;
"""
    )
    print("Staff theme applied.")


def main() -> None:
    js = (ROOT / "opac-loader.js").read_text(encoding="utf-8")
    extra_css = (ROOT / "opac-extra.css").read_text(encoding="utf-8")
    main_html = (ROOT / "blocks" / "main.html").read_text(encoding="utf-8")
    loader = extra_css + "\n/* theme files: /opac-custom/opac-dbc.css */\n"
    sql = f"""
UPDATE systempreferences SET value='Don Bosco College Library' WHERE variable='LibraryName';
UPDATE systempreferences SET value='{sql_str(loader)}' WHERE variable='OPACUserCSS';
UPDATE systempreferences SET value='{sql_str(js)}' WHERE variable='OPACUserJS';
UPDATE additional_contents_localizations SET content='' WHERE additional_content_id=4;
UPDATE additional_contents_localizations SET content='{sql_str(main_html)}' WHERE additional_content_id=5;
UPDATE additional_contents_localizations SET content='' WHERE additional_content_id=6;
UPDATE additional_contents_localizations SET content='' WHERE additional_content_id=7;
UPDATE additional_contents_localizations SET content='' WHERE additional_content_id=3;
"""
    run_sql(sql)
    print("OPAC theme applied.")
    apply_staff()


if __name__ == "__main__":
    main()
