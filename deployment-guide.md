# Deployment Setup Guide

## Important: Replace Placeholders

Before deploying, you MUST replace the following placeholders in your files:

### 1. In `.github/workflows/ci-cd.yml`
Replace `your-docker-repo/your-image-name` with your actual Docker Hub details:

**Example:**
- If your Docker Hub username is `johndoe` 
- And you want to name your image `discord-crypto-bot`
- Then replace `your-docker-repo/your-image-name` with `johndoe/discord-crypto-bot`

### 2. In `docker-compose.yml` 
Update the image name to match what you used in step 1:
```yaml
services:
  backend:
    image: johndoe/discord-crypto-bot:latest  # Replace with your actual image name
```

### 3. Server Directory Structure
Ensure your DigitalOcean server has the correct directory structure:

```bash
# SSH into your server and run:
mkdir -p ~/trading-idea-bot
cd ~/trading-idea-bot

# Copy your updated docker-compose.yml and .env.backend files here
# You can use scp, rsync, or manually create them
```

## Deployment Flow

1. **GitHub Actions builds and pushes image to Docker Hub**
2. **SSH into server and pulls the pre-built image**
3. **Restarts only the backend service with new image**

## Key Changes Made

### docker-compose.yml
- ✅ Removed `build: .` (no more building on server)
- ✅ Added `image:` pointing to Docker Hub
- ✅ Uses `:latest` tag for consistent deployments

### CI/CD Workflow
- ✅ Tags image with both commit SHA and `:latest`
- ✅ Pushes both tags to Docker Hub
- ✅ Deployment script pulls only backend service
- ✅ Restarts only backend service (faster deployments)

### Benefits
- 🚀 **Faster deployments** (no building on server)
- 🔒 **More reliable** (consistent build environment)
- 💾 **Less server resources** (no build dependencies needed)
- 🎯 **Better rollbacks** (can easily switch between image tags)

## Next Steps

1. Replace the placeholders as described above
2. Commit and push your changes
3. Copy the updated `docker-compose.yml` to your server
4. Run the GitHub Actions workflow
5. Your deployment should now work without build errors!