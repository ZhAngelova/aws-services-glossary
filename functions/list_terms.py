"""
Lambda handler for listing all AWS service terms in the glossary.

Endpoint: GET /services
Returns all terms as a JSON array, sorted alphabetically by serviceName.
"""

# -----------------------------------------------------------------------------
# Layer 1: Imports
# -----------------------------------------------------------------------------
import json
import os
from decimal import Decimal

import boto3


# -----------------------------------------------------------------------------
# Layer 2: Constants and clients
# -----------------------------------------------------------------------------
TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


# -----------------------------------------------------------------------------
# Layer 3: Helpers
# -----------------------------------------------------------------------------
def _decimal_default(obj):
    """Convert DynamoDB Decimal types so json.dumps can serialise them."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Type {type(obj)} not serialisable")


def _response(status_code: int, body) -> dict:
    """Build a standard API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=_decimal_default),
    }


# -----------------------------------------------------------------------------
# Layer 4: Handler
# -----------------------------------------------------------------------------
def lambda_handler(event, context):
    """Entry point for the list_terms Lambda."""
    # Scan the table to retrieve all items
    response = table.scan()
    items = response.get("Items", [])

    # DynamoDB scan returns max 1MB per call - paginate if the table is larger
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    # Sort alphabetically by serviceName for a consistent order
    items.sort(key=lambda x: x.get("serviceName", ""))

    return _response(200, {"count": len(items), "terms": items})