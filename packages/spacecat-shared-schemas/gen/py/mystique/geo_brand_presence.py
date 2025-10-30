# ADOBE CONFIDENTIAL
#
# Copyright 2025 Adobe
# All Rights Reserved.
#
# NOTICE:  All information contained herein is, and remains
# the property of Adobe and its suppliers, if any. The intellectual
# and technical concepts contained herein are proprietary to Adobe
# and its suppliers and are protected by all applicable intellectual
# property laws, including trade secret and copyright laws.
# Dissemination of this information or reproduction of this material
# is strictly forbidden unless prior written permission is obtained
# from Adobe.

from uuid import UUID
from pydantic import HttpUrl
from datetime import datetime
from typing import Literal

from .._common import schema

@schema
class DetectMessage:
    @schema
    class CalendarWeek:
        date: datetime | None = None
        week: float
        year: float

    audit_id: UUID
    base_url: HttpUrl
    calendar_week: CalendarWeek
    config_version: str | None
    date: datetime | None = None
    delivery_type: str
    site_id: UUID
    type: Literal["detect:geo-brand-presence", "detect:geo-brand-presence-daily"]
    url: HttpUrl
    web_search_provider: Literal["ai_mode", "all", "chatgpt", "copilot", "gemini", "google_ai_overviews", "perplexity"]

