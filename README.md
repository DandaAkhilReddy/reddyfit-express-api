# 🚀 ReddyFit Express.js API

Production-ready Express.js API for ReddyFit fitness platform with Azure SQL Database integration.

## ✅ Features

- ✅ **Express.js** - Fast, minimalist web framework
- ✅ **Azure SQL Database** - Full integration with connection pooling
- ✅ **CORS Enabled** - Configured for frontend at white-meadow-001c09f0f.2.azurestaticapps.net
- ✅ **Security** - Helmet for security headers, JWT ready
- ✅ **Compression** - Response compression for faster API
- ✅ **Error Handling** - Comprehensive error middleware
- ✅ **Health Checks** - `/api/health` endpoint for monitoring
- ✅ **Logging** - Morgan HTTP request logging

## 📋 Prerequisites

- Node.js 18+ installed
- Azure CLI installed
- Azure subscription
- Azure SQL Database (already set up: reddyfit-sql-server.database.windows.net)

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies

```bash
cd reddyfit-express-api
npm install
```

### 2. Create .env file

```bash
cp .env.example .env
```

Edit `.env` with your actual database credentials (already provided in .env.example).

### 3. Run Locally

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

### 4. Test Health Check

```bash
curl http://localhost:8080/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T02:00:00.000Z",
  "database": "connected",
  "uptime": 5.123,
  "environment": "development"
}
```

## 🌐 Deploy to Azure App Service

### Option 1: Azure CLI (Fastest - 5 minutes)

```bash
# 1. Login to Azure
az login

# 2. Create resource group (if not exists)
az group create --name sixpack-rg --location eastus2

# 3. Create App Service Plan
az appservice plan create \
  --name reddyfit-plan \
  --resource-group sixpack-rg \
  --sku B1 \
  --is-linux

# 4. Create Web App
az webapp create \
  --resource-group sixpack-rg \
  --plan reddyfit-plan \
  --name reddyfit-express-api \
  --runtime "NODE:18-lts"

# 5. Configure environment variables
az webapp config appsettings set \
  --resource-group sixpack-rg \
  --name reddyfit-express-api \
  --settings \
    AZURE_SQL_SERVER="reddyfit-sql-server.database.windows.net" \
    AZURE_SQL_DATABASE="reddyfitdb" \
    AZURE_SQL_USER="reddyfitadmin" \
    AZURE_SQL_PASSWORD="ReddyFit@2025SecurePass!" \
    NODE_ENV="production" \
    JWT_SECRET="$(openssl rand -base64 32)" \
    CORS_ORIGINS="https://white-meadow-001c09f0f.2.azurestaticapps.net"

# 6. Deploy code
az webapp up \
  --resource-group sixpack-rg \
  --name reddyfit-express-api \
  --runtime "NODE:18-lts" \
  --os-type Linux

# 7. View logs
az webapp log tail --name reddyfit-express-api --resource-group sixpack-rg
```

### Option 2: GitHub Actions (Automated CI/CD)

1. **Get Publish Profile**:
```bash
az webapp deployment list-publishing-profiles \
  --resource-group sixpack-rg \
  --name reddyfit-express-api \
  --xml
```

2. **Add to GitHub Secrets**:
   - Go to GitHub repo → Settings → Secrets → Actions
   - Create secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Paste the XML from step 1

3. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial Express API setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reddyfit-express-api.git
git push -u origin main
```

GitHub Actions will automatically deploy on every push!

### Option 3: ZIP Deploy

```bash
# Create deployment package
zip -r deploy.zip . -x "node_modules/*" -x ".git/*" -x ".env"

# Deploy
az webapp deployment source config-zip \
  --resource-group sixpack-rg \
  --name reddyfit-express-api \
  --src deploy.zip
```

## 🧪 Testing the Deployed API

### 1. Health Check

```bash
curl https://reddyfit-express-api.azurewebsites.net/api/health
```

### 2. Create User Profile

```bash
curl -X POST https://reddyfit-express-api.azurewebsites.net/api/users/profile \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firebase_uid": "test123",
    "full_name": "Test User",
    "gender": "male"
  }'
```

Expected response:
```json
{
  "message": "Profile created",
  "id": "some-guid"
}
```

### 3. Get All Users

```bash
curl https://reddyfit-express-api.azurewebsites.net/api/users/all
```

### 4. Submit Onboarding

```bash
curl -X POST https://reddyfit-express-api.azurewebsites.net/api/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fitness_goal": "Weight Loss",
    "current_fitness_level": "Beginner",
    "workout_frequency": "3-4",
    "diet_preference": "Vegetarian",
    "motivation": "Get healthier",
    "biggest_challenge": "Time management",
    "how_found_us": "Instagram",
    "feature_interest": ["AI Workout Plans", "Meal Plans"],
    "willing_to_pay": "Yes",
    "price_range": "10_20"
  }'
```

## 🔄 Update Frontend to Use New API

### In your frontend project (`ReddyfitWebsiteready`):

Update `src/lib/api.ts`:

```typescript
// Change this line:
const API_BASE_URL = 'https://reddyfit-api.azurewebsites.net/api';

// To this:
const API_BASE_URL = 'https://reddyfit-express-api.azurewebsites.net/api';
```

Then commit and push:

```bash
cd /c/users/akhil/ReddyfitWebsiteready
git add src/lib/api.ts
git commit -m "Switch to Express.js API"
git push origin main
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users/all` | Get all users (admin) |
| GET | `/api/users/profile?email=...` | Get user profile |
| POST | `/api/users/profile` | Create/update user profile |
| PUT | `/api/users/onboarding-status` | Update onboarding status |
| POST | `/api/onboarding` | Submit onboarding responses |

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_SQL_SERVER` | SQL Server hostname | ✅ |
| `AZURE_SQL_DATABASE` | Database name | ✅ |
| `AZURE_SQL_USER` | Database username | ✅ |
| `AZURE_SQL_PASSWORD` | Database password | ✅ |
| `PORT` | Server port (default: 8080) | ❌ |
| `NODE_ENV` | Environment (production/development) | ❌ |
| `JWT_SECRET` | Secret for JWT tokens | ❌ |
| `CORS_ORIGINS` | Allowed CORS origins | ❌ |

## 🐛 Troubleshooting

### Database Connection Fails

```bash
# Test database connectivity
az sql server firewall-rule create \
  --resource-group sixpack-rg \
  --server reddyfit-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### View Application Logs

```bash
# Stream logs
az webapp log tail \
  --resource-group sixpack-rg \
  --name reddyfit-express-api

# Download logs
az webapp log download \
  --resource-group sixpack-rg \
  --name reddyfit-express-api \
  --log-file logs.zip
```

### App Not Starting

```bash
# Check app settings
az webapp config appsettings list \
  --resource-group sixpack-rg \
  --name reddyfit-express-api

# Restart app
az webapp restart \
  --resource-group sixpack-rg \
  --name reddyfit-express-api
```

## 📈 Scaling

### Scale Up (More Resources)

```bash
# Upgrade to Premium tier for better performance
az appservice plan update \
  --name reddyfit-plan \
  --resource-group sixpack-rg \
  --sku P1V2
```

### Scale Out (More Instances)

```bash
# Add more instances for load balancing
az appservice plan update \
  --name reddyfit-plan \
  --resource-group sixpack-rg \
  --number-of-workers 3
```

## 🔒 Security Checklist

- ✅ Helmet security headers enabled
- ✅ CORS configured for specific origins
- ✅ SQL parameterized queries (prevents SQL injection)
- ✅ Environment variables for secrets
- ✅ HTTPS enforced on Azure App Service
- ⚠️ Add rate limiting for production
- ⚠️ Add input validation middleware
- ⚠️ Enable Azure Application Insights for monitoring

## 📊 Performance Optimization

- ✅ Compression middleware enabled
- ✅ Database connection pooling
- ✅ Response caching headers
- ⚠️ Add Redis for session caching (optional)
- ⚠️ Enable Azure CDN for static content

## 🚀 Go Live Checklist

- [ ] Deploy to Azure App Service
- [ ] Test all endpoints
- [ ] Configure custom domain (optional)
- [ ] Enable SSL certificate
- [ ] Set up Application Insights
- [ ] Configure alerts and monitoring
- [ ] Update frontend API URL
- [ ] Test frontend → backend integration
- [ ] Load testing with curl/Postman
- [ ] Enable auto-scaling

## 📞 Support

For issues or questions:
- Check logs: `az webapp log tail --name reddyfit-express-api --resource-group sixpack-rg`
- Monitor health: `https://reddyfit-express-api.azurewebsites.net/api/health`
- Review Azure Portal: https://portal.azure.com

---

**Made with ❤️ for ReddyFit** 🏋️‍♂️
