"""
Lambda handler for updating an existing AWS service term in the glossary.

Endpoint: PUT /services/{name}
Body: JSON with any subset of displayName, description, category, useCases.
Returns 404 if the term doesn't exist.
"""

# -----------------------------------------------------------------------------
# Layer 1: Imports
# -----------------------------------------------------------------------------
import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3


# -----------------------------------------------------------------------------
# Layer 2: Constants and clients
# -----------------------------------------------------------------------------
TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# Fields a client is allowed to update. Excludes serviceName (the key),
# and the audit fields addedAt/addedBy which should never change.
UPDATABLE_FIELDS = ["displayName", "description", "category", "useCases"]


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
            "Access-Control-Allow-Methods": "PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=_decimal_default),
    }


# -----------------------------------------------------------------------------
# Layer 4: Handler
# -----------------------------------------------------------------------------
def lambda_handler(event, context):
    """Entry point for the update_term Lambda."""
    # Get the service name from the URL path (e.g. /services/ec2 -> "ec2")
    path_params = event.get("pathParameters") or {}
    service_name = (path_params.get("name") or "").strip().lower()
    if not service_name:
        return _response(400, {"error": "Missing service name in URL"})

    # Parse the request body
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON in request body"})

    # Fetch the existing item
    result = table.get_item(Key={"serviceName": service_name})
    existing = result.get("Item")
    if not existing:
        return _response(404, {"error": f"Term '{service_name}' not found"})

    # Apply only fields the client sent AND are in the allow-list
    updated_fields = []
    for field in UPDATABLE_FIELDS:
        if field in payload:
            existing[field] = payload[field]
            updated_fields.append(field)

    if not updated_fields:
        return _response(400, {"error": "No updatable fields provided"})

    # Refresh the updatedAt timestamp
    existing["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Write the modified item back
    table.put_item(Item=existing)

    return _response(200, {"message": "Term updated", "term": existing})