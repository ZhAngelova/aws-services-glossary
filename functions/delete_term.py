"""
Lambda handler for deleting an AWS service term from the glossary.

Endpoint: DELETE /services/{name}
Returns 404 if the term doesn't exist.
"""

# -----------------------------------------------------------------------------
# Layer 1: Imports
# -----------------------------------------------------------------------------
import json
import os

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
            "Access-Control-Allow-Methods": "DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


# -----------------------------------------------------------------------------
# Layer 4: Handler
# -----------------------------------------------------------------------------
def lambda_handler(event, context):
    """Entry point for the delete_term Lambda."""
    # Get the service name from the URL path
    path_params = event.get("pathParameters") or {}
    service_name = (path_params.get("name") or "").strip().lower()
    if not service_name:
        return _response(400, {"error": "Missing service name in URL"})

    # Conditional delete — DynamoDB refuses if the term doesn't exist
    try:
        table.delete_item(
            Key={"serviceName": service_name},
            ConditionExpression="attribute_exists(serviceName)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _response(404, {"error": f"Term '{service_name}' not found"})
        raise

    return _response(200, {"message": f"Term '{service_name}' deleted"})