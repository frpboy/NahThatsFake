
# Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Vercel (Recommended for TMA)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with automatic builds on push

### Option 2: Railway
1. Connect your GitHub repository
2. Configure environment variables
3. Deploy both bot and TMA services

### Option 3: Docker + VPS
1. Set up a VPS (DigitalOcean, AWS EC2, etc.)
2. Install Docker and Docker Compose
3. Deploy using the provided docker-compose.yml

## 📋 Pre-deployment Checklist

### Database Setup
- [ ] Create Supabase project
- [ ] Run all SQL migrations
- [ ] Configure RLS policies
- [ ] Set up database functions
- [ ] Test database connections

### API Keys Setup
- [ ] Telegram Bot Token
- [ ] Supabase credentials
- [ ] Razorpay keys (for payments)
- [ ] Sightengine API keys
- [ ] Google Safe Browsing API key
- [ ] VirusTotal API key

### Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required environment variables
- [ ] Test environment variables locally
- [ ] Set up production environment variables

### Security Setup
- [ ] Enable RLS policies in Supabase
- [ ] Configure rate limiting
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts

## 🐳 Docker Deployment

### Build and Run
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Considerations
- Use external PostgreSQL database instead of containerized
- Set up Redis for caching and rate limiting
- Configure proper SSL certificates
- Set up log aggregation
- Configure health checks and monitoring

## 📊 Monitoring and Maintenance

### Health Checks
- Bot health: `GET /health` endpoint
- TMA health: `GET /health` endpoint
- Database: Monitor connection pool and query performance

### Logs and Monitoring
- Application logs: Use structured logging
- Error tracking: Integrate with Sentry
- Performance monitoring: Use APM tools
- Database monitoring: Monitor query performance

### Backup Strategy
- Database: Automated daily backups
- Configuration: Version controlled in Git
- Secrets: Stored securely in environment variables

## 🔧 Troubleshooting

### Common Issues
1. **Bot not responding**: Check bot token and webhook configuration
2. **Database connection errors**: Verify Supabase credentials
3. **Payment failures**: Check Razorpay webhook configuration
4. **TMA not loading**: Verify HTTPS and CORS settings

### Performance Optimization
- Enable caching for API responses
- Optimize database queries
- Use connection pooling
- Implement proper indexing

## 📞 Support

For deployment support:
- Check the troubleshooting section
- Review logs for error messages
- Test API endpoints manually
- Verify environment configuration

## 🔄 Updates and Maintenance

### Updating the Application
1. Test changes in staging environment
2. Update environment variables if needed
3. Deploy with zero-downtime strategy
4. Monitor for issues after deployment

### Database Migrations
- Always backup before migrations
- Test migrations in staging first
- Use migration scripts for schema changes
- Monitor database performance after changes
