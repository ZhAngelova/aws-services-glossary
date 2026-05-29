"""
Lambda handler for creating new AWS service terms in the glossary.

Endpoint: POST /services
Body: JSON with serviceName, displayName, description, and optional fields.
Refuses duplicates via DynamoDB conditional write (returns HTTP 409).
"""

# -----------------------------------------------------------------------------
# Layer 1: Imports
# -----------------------------------------------------------------------------
import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


# -----------------------------------------------------------------------------
# Layer 2: Constants and clients
# -----------------------------------------------------------------------------
TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


# -----------------------------------------------------------------------------
# Layer 3: Helpers
# -----------------------------------------------------------------------------
def _response(status_code: int, body: dict) -> dict:
    """Build a standard API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def _validate(payload: dict) -> str | None:
    """Return an error message if payload is invalid, else None."""
    required_fields = ["serviceName", "displayName", "description"]
    for field in required_fields:
        if not payload.get(field):
            return f"Missing required field: {field}"
    if len(payload["serviceName"]) > 50:
        return "serviceName must be 50 characters or fewer"
    return None


# -----------------------------------------------------------------------------
# Layer 4: Handler
# -----------------------------------------------------------------------------
def lambda_handler(event, context):
    """Entry point for the create_term Lambda."""
    # Parse incoming JSON body
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON in request body"})

    # Validate required fields
    error = _validate(payload)
    if error:
        return _response(400, {"error": error})

    # Normalise the partition key (lowercase, trimmed) - your dedup key
    service_name = payload["serviceName"].strip().lower()

    # Build the item to store
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "serviceName": service_name,
        "displayName": payload["displayName"].strip(),
        "description": payload["description"].strip(),
        "category": payload.get("category", "").strip(),
        "useCases": payload.get("useCases", []),
        "addedBy": payload.get("addedBy", "anonymous"),
        "addedAt": now,
        "updatedAt": now,
    }

    # Conditional write - DynamoDB refuses if serviceName already exists
    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(serviceName)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _response(409, {"error": f"Term '{service_name}' already exists"})
        raise

    return _response(201, {"message": "Term created", "term": item})