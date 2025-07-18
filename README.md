# github to telegram notifier

a production-ready node.js app that receives github webhook events and sends formatted notifications to a telegram chat

## features

- **real-time notifications**: receives github webhooks and sends immediate telegram notifications
- **secure webhook validation**: hmac-sha256 signature validation for github webhooks
- **event deduplication**: prevents duplicate notifications for the same event
- **rate limiting**: respects telegram api rate limits (30 messages/second)
- **comprehensive logging**: structured logging with winston for debugging and monitoring
- **docker support**: ready for containerized deployment
- **health monitoring**: built-in health check endpoint

## supported events

currently supports **push events** with comprehensive parsing for:

- branch information
- commit details and messages
- file changes (added, modified, removed)
- author information
- repository links

_note: the parser also handles pull requests, issues, and ci events, but only push events are currently forwarded to telegram._

## prerequisites

- node.js 18+ or docker
- a telegram bot token (from [@botfather](https://t.me/botfather))
- a telegram chat id where notifications will be sent
- a github repository with webhook access

## installation

### local development

1. **clone the repository**

   ```bash
   git clone https://github.com/tacbuild/git-watcher.git
   cd git-watcher
   ```

2. **install dependencies**

   ```bash
   npm install
   ```

3. **set up environment variables**

   ```bash
   cp .env.example .env
   # edit .env with your configuration
   ```

4. **build the application**

   ```bash
   npm run build
   ```

5. **start the application**
   ```bash
   npm start
   ```

### docker deployment

1. **build the docker image**

   ```bash
   docker build -t git-watcher .
   ```

2. **run with docker compose**
   ```bash
   docker-compose up -d
   ```

## environment variables

| variable                | description                             | required | default     |
| ----------------------- | --------------------------------------- | -------- | ----------- |
| `port`                  | port for the http server                | no       | 3000        |
| `node_env`              | environment (development/production)    | no       | development |
| `log_level`             | logging level (error/warn/info/debug)   | no       | info        |
| `telegram_bot_token`    | your telegram bot token                 | yes      | -           |
| `telegram_chat_id`      | target chat id for notifications        | yes      | -           |
| `github_webhook_secret` | secret for webhook signature validation | yes      | -           |

## getting started

### 1. create a telegram bot

1. message [@botfather](https://t.me/botfather) on telegram
2. send `/newbot` and follow the instructions
3. save the bot token provided

### 2. get chat id

1. add your bot to the target chat/group
2. send a message to the chat
3. visit `https://api.telegram.org/bot<your_bot_token>/getupdates`
4. find your chat id in the response

### 3. configure github webhook

1. go to your github repository settings
2. navigate to "webhooks" → "add webhook"
3. set payload url to: `https://your-domain.com/webhook`
4. set content type to: `application/json`
5. generate a secret and add it to your `.env` file
6. select "send me everything" or choose specific events
7. ensure the webhook is active

### 4. test the setup

1. start the application
2. visit `http://localhost:3000/health` to check if it's running
3. visit `http://localhost:3000/test-telegram` to test telegram connectivity
4. push to your github repository to test the webhook

## api endpoints

| endpoint         | method | description                    |
| ---------------- | ------ | ------------------------------ |
| `/health`        | get    | health check endpoint          |
| `/test-telegram` | get    | test telegram bot connectivity |
| `/webhook`       | post   | github webhook receiver        |

## development

### available scripts

- `npm run build` - build the typescript code
- `npm run dev` - start development server with hot reload
- `npm start` - start production server
- `npm run lint` - run eslint
- `npm run lint:fix` - fix eslint issues
- `npm run format` - format code with prettier
- `npm run format:check` - check code formatting

### project structure

```
src/
├── controllers/     # http request handlers
├── middleware/      # express middleware
├── services/        # business logic services
├── types/          # typescript type definitions
└── utils/          # utility functions
```

## deployment

### docker deployment

the application includes a multi-stage dockerfile optimized for production:

```bash
# build and run with docker
docker build -t git-watcher .
docker run -p 3000:3000 --env-file .env git-watcher
```

### using docker compose

```bash
# start the service
docker-compose up -d

# check logs
docker-compose logs -f

# stop the service
docker-compose down
```

## monitoring

the application provides structured logging and health monitoring:

- **health check**: `get /health` returns application status and cache statistics
- **logs**: written to `logs/` directory with rotation
- **metrics**: request duration, event processing status, telegram api calls
