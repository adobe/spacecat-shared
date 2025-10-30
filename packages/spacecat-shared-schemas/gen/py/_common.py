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

from pydantic import ConfigDict
from pydantic.dataclasses import dataclass
from pydantic.alias_generators import to_camel

CONFIG = ConfigDict(
  alias_generator = to_camel,
  validate_by_alias=True,
  validate_by_name=True,
)

def schema(cls):
  return dataclass(cls, config=CONFIG)
