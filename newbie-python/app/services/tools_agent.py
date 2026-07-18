from tavily import TavilyClient
from langchain_core.tools import tool
from app.config import settings
from datetime import datetime
import logging
import pytz
from lunarcalendar import Converter, Solar

logger = logging.getLogger(__name__)

_tavily_client = TavilyClient(api_key=str(settings.TAVILY_API_KEY))

@tool
def web_search(query: str) -> str:
    """
    Search the web for up-to-date information.

    Use for:
    - latest news
    - current events
    - pricing
    - salaries
    - technology trends
    """
    return str(_tavily_client.search(query, max_results=3))

tavily_tools = web_search


@tool
def get_lunar_date(target_date: str = "") -> str:
    """
    Convert a solar (dương lịch) date to the lunar (âm lịch) date.

    You MUST call this tool — do NOT guess or use your training knowledge — for any of the following:
    - User asks about today's lunar date: pass target_date="" (empty) or omit it.
    - User asks about a specific date's lunar equivalent: pass the date as target_date in "YYYY-MM-DD" or "DD/MM/YYYY" format.

    Examples:
    - "Hôm nay âm lịch là ngày mấy?" → call with target_date=""
    - "Ngày 25/12/2025 âm lịch là ngày mấy?" → call with target_date="2025-12-25"
    - "20/01/2026 tương ứng ngày âm nào?" → call with target_date="2026-01-20"
    """
    logger.info("[get_lunar_date] Tool called with target_date='%s'", target_date)
    timezone = "Asia/Ho_Chi_Minh"
    try:
        tz = pytz.timezone(timezone)

        # Parse target_date or fall back to today
        if target_date and target_date.strip():
            date_str = target_date.strip()
            # Try multiple formats: YYYY-MM-DD and DD/MM/YYYY
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    parsed = datetime.strptime(date_str, fmt)
                    solar_date = parsed
                    break
                except ValueError:
                    continue
            else:
                return f"Không thể đọc định dạng ngày '{date_str}'. Vui lòng dùng định dạng YYYY-MM-DD hoặc DD/MM/YYYY."
        else:
            solar_date = datetime.now(tz)

        solar = Solar(solar_date.year, solar_date.month, solar_date.day)
        lunar = Converter.Solar2Lunar(solar)

        leap_str = " (tháng nhuận)" if lunar.isleap else ""
        solar_label = solar_date.strftime("%d/%m/%Y")

        result = (
            f"Ngày dương lịch {solar_label} tương ứng với "
            f"Mùng {lunar.day} tháng {lunar.month}{leap_str} năm {lunar.year} (âm lịch)."
        )
        print(f"[get_lunar_date] Result: {result}")
        return result

    except pytz.UnknownTimeZoneError:
        return f"Error: Unknown timezone '{timezone}'."
    except Exception as e:
        logger.error("[get_lunar_date] Error: %s", e)
        return f"Error calculating lunar date: {str(e)}"

