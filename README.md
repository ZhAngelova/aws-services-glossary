# AWS Services Glossary

I decided to build a collaborative glossary of AWS services, built for the AWS re/Start with AI bootcamp class. Each day we recall and add services and their short description.


## Who This Is For

This project doubles as a learning resource for anyone new to AWS- particularly bootcamp students and self-taught beginners. The **Why This Stack** section below explains the reasoning behind every technology choice, so you can understand not just *what* was built but *why*. The `template.yaml` and Lambda functions are designed to be readable and reusable as a reference for your own first serverless app.


## Features

- Add new AWS service terms (with duplicate prevention)
- View, edit, and delete existing terms
- Serverless architecture deployed on AWS


## Why This Stack

The architecture was chosen with four priorities, in order:

1. **Operational simplicity**- no servers to patch, scale, or monitor.
2. **Cost**- must run at $0 within the AWS Free Tier at this scale.
3. **Portfolio relevance**- services that are common in junior cloud and DevOps roles.
4. **Educational value**- readable code and clear reasoning for other learners.


## Live API

The backend is deployed and running at:
https://b16zplto5k.execute-api.eu-west-2.amazonaws.com/Prod/


### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /services | Create a new term. Refuses duplicates with HTTP 409. |
| GET | /services | List all terms, sorted alphabetically. |
| PUT | /services/{name} | Update an existing term. Audit fields are protected. |
| DELETE | /services/{name} | Delete a term. Returns HTTP 404 if it does not exist. |

### Example: create a term

```bash
curl -X POST https://b16zplto5k.execute-api.eu-west-2.amazonaws.com/Prod/services \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "lambda",
    "displayName": "AWS Lambda",
    "description": "Run code without provisioning or managing servers."
  }'
```

Response: HTTP 201 with the created term echoed back as JSON.


### Compute: AWS Lambda

I chose AWS Lambda over EC2 because this app will see very low, sporadic traffic- likely a few dozen requests a day at most. Running a 24/7 EC2 instance for that would be wasteful both in cost and effort: I'd have to manage the OS, patches, scaling, and security. Lambda runs only when an HTTP request comes in, scales automatically from zero to thousands of concurrent executions, and the AWS Free Tier includes **1 million free requests per month and 400,000 GB-seconds of compute every month, forever**- not just for the first year. For an app of this size, that means $0/month in compute cost.

**Trade-off worth knowing:** Lambda has "cold starts"- a small startup delay (a few hundred milliseconds) the first time a function runs after being idle. For a class glossary, that's invisible to users. For a high-traffic production API, you'd care more and reach for provisioned concurrency or different architectures.


### Data: Amazon DynamoDB

I chose DynamoDB over a relational database like RDS or Aurora because the data here is simple: a flat list of AWS service terms with no JOINs, no complex queries across tables, no transactions. DynamoDB is fully managed (no patching, no scaling decisions), gives single-digit millisecond reads at any scale, and includes **25 GB of storage and 25 read/write capacity units free forever**.

A small RDS instance starts at around $15/month minimum even when idle. DynamoDB on-demand pricing for a project this size is effectively $0.

The deeper reason I picked DynamoDB: it solves the duplicate-prevention requirement elegantly. I use the service name (lowercased) as the **partition key**, and DynamoDB's `attribute_not_exists()` condition expression means duplicates are physically impossible- the database itself rejects any write that would create one. That's atomic, race-condition-free, and built into the write operation. Cleaner than a `UNIQUE` constraint in SQL.


### API Layer: Amazon API Gateway

API Gateway is the public HTTPS endpoint that receives browser requests and routes them to the right Lambda function. I chose it over alternatives like running my own Flask server on EC2 or using an Application Load Balancer because:

- It integrates natively with Lambda- no glue code, no extra plumbing.
- It handles HTTPS, throttling, and CORS for me.
- The Free Tier covers 1 million requests/month for the first 12 months, then $1 per million afterwards.

For an app like this, it's both the simplest setup and the cheapest.


### Frontend Hosting: Amazon S3 + CloudFront

The frontend is plain HTML, CSS, and JavaScript- no server needed. S3 stores the files; CloudFront is AWS's content delivery network (CDN), which caches them at edge locations around the world so pages load fast no matter where the user is.

I picked this over AWS Amplify Hosting (which is easier to set up but more abstracted) because I wanted to learn how S3 static hosting actually works under the hood. The Free Tier covers 5 GB of S3 storage and 1 TB of CloudFront data transfer per month for the first 12 months- far more than this project will ever use.

CloudFront also provides a free HTTPS certificate via AWS Certificate Manager, so the site is secure by default.


### Infrastructure as Code: AWS SAM

Every AWS resource above is defined in a single `template.yaml` file- that's the Infrastructure as Code (IaC) approach. The benefit is reproducibility: someone else can clone this repo, run `sam deploy`, and get an identical copy of the entire backend in their own AWS account in about three minutes. No clicking around the console, no missed configuration steps.

I picked AWS SAM over raw CloudFormation because SAM is roughly 5× more compact for serverless apps- its `AWS::Serverless::Function` resource expands automatically into the multiple CloudFormation resources you'd otherwise write by hand. Under the hood, SAM templates compile down to CloudFormation, so by learning SAM I'm picking up CloudFormation too.

I picked SAM over Terraform because this project is pure serverless on AWS only. Terraform's strength is multi-cloud and broad multi-service infrastructure; for a small AWS-only serverless app, SAM is purpose-built and has a much faster local testing loop (`sam local start-api` runs the whole API on my laptop).


### What I Deliberately Did NOT Use

Picking the right tools also means rejecting the wrong ones. Here are services I considered and chose not to use for this project, and why:

- **ECS / Fargate (container-based compute):** Overkill for this traffic level. Cheapest Fargate setup runs ~$5–10/month even when idle; Lambda is $0.
- **RDS / Aurora (relational database):** Minimum spend is ~$15/month even for the smallest instance. The data here doesn't need a relational model.
- **Cognito (user authentication):** Version 1 has no logins- the API is open for trusted classmates only. Auth will be added later if it becomes necessary. Adding it now would be over-engineering.
- **OpenSearch / ElasticSearch:** Search across fewer than 1,000 items doesn't need a search engine. A simple DynamoDB scan with client-side filtering is more than enough.


## Project Structure

```
aws-services-glossary/
├── README.md
├── template.yaml             SAM infrastructure-as-code, defines every AWS resource
├── samconfig.toml             Saved sam deploy settings, auto-generated on first deploy
├── .gitignore
└── functions/
    ├── create_term.py        POST /services
    ├── list_terms.py         GET /services
    ├── update_term.py        PUT /services/{name}
    ├── delete_term.py        DELETE /services/{name}
    └── requirements.txt      Empty: boto3 is bundled in the Lambda runtime
```

Each Lambda follows the same four-layer code structure: Imports, Constants and clients, Helpers, Handler.


## Built With

- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- Amazon S3 + Amazon CloudFront (static frontend hosting)
- AWS SAM (Infrastructure as Code)
- Python 3
- HTML / CSS / JavaScript


## Author

**Zhasmina Angelova**
- GitHub: [ZhAngelova](https://github.com/ZhAngelova)
- LinkedIn: [zhasmina-angelova](https://www.linkedin.com/in/zhasmina-angelova/)