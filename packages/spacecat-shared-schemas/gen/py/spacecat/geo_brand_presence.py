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
from typing import Literal
from pydantic import HttpUrl
from datetime import datetime

from .._common import schema

@schema
class DetectMessage:
    @schema
    class Data:
        presigned_url: HttpUrl
        date: datetime | None = None
        week: float | None = None
        year: float | None = None

    site_id: UUID
    type: Literal["detect:geo-brand-presence", "detect:geo-brand-presence-daily"]
    audit_id: UUID
    data: Data

