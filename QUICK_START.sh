#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# QUICK START SCRIPT - PropX-Exchange Dev Environment
# ═══════════════════════════════════════════════════════════════════════════
# Cách dùng: bash QUICK_START.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "🚀 PropX-Exchange Dev Environment Setup"
echo "═══════════════════════════════════════════════════════════════════════════"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "\n${YELLOW}[1/7]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"

# Check Yarn
echo -e "\n${YELLOW}[2/7]${NC} Checking Yarn..."
if ! command -v yarn &> /dev/null; then
    echo -e "${RED}❌ Yarn is not installed${NC}"
    exit 1
fi
YARN_VERSION=$(yarn -v)
echo -e "${GREEN}✓ Yarn installed: $YARN_VERSION${NC}"

# Check Docker
echo -e "\n${YELLOW}[3/7]${NC} Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi
DOCKER_VERSION=$(docker --version)
echo -e "${GREEN}✓ Docker installed: $DOCKER_VERSION${NC}"

# Create .env file if not exists
echo -e "\n${YELLOW}[4/7]${NC} Setting up environment variables..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << 'EOF'
# Database
DB_HOST=localhost
DB_PORT=3307
DB_USER=propx
DB_PASSWORD=propx
DB_NAME=propx
DB_ROOT_PASSWORD=propx_root
DATABASE_URL=mysql://propx:propx@localhost:3307/propx

# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=dev_secret_key_change_in_production_12345

# Blockchain
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}[5/7]${NC} Installing dependencies..."
yarn install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Install smart contract dependencies
echo -e "\n${YELLOW}[6/7]${NC} Installing smart contract dependencies..."
cd smart-contracts

# Create empty yarn.lock to treat as separate project
touch yarn.lock

# Use npm to install with legacy peer deps (to bypass version conflicts)
npm install --legacy-peer-deps

# Ensure hardhat-toolbox peer deps are installed
npm install --save-dev --legacy-peer-deps \
    "@nomicfoundation/hardhat-chai-matchers@^2.0.0" \
    "@nomicfoundation/hardhat-ethers@^3.0.0" \
    "@nomicfoundation/hardhat-ignition-ethers@^0.15.0" \
    "@nomicfoundation/hardhat-network-helpers@^1.0.0" \
    "@nomicfoundation/hardhat-verify@^2.0.0" \
    "@typechain/ethers-v6@^0.5.0" \
    "@typechain/hardhat@^9.0.0" \
    "hardhat-gas-reporter@^1.0.8" \
    "solidity-coverage@^0.8.1" \
    "typechain@^8.3.0" \
    "@nomicfoundation/hardhat-ignition@^0.15.16" \
    "@nomicfoundation/ignition-core@^0.15.15"

cd ..
echo -e "${GREEN}✓ Smart contract dependencies installed${NC}"

# Compile smart contracts
echo -e "\n${YELLOW}[7/7]${NC} Compiling smart contracts..."
cd smart-contracts
npm run build
cd ..
echo -e "${GREEN}✓ Smart contracts compiled${NC}"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}📋 Next steps:${NC}\n"
echo "1. Start Docker services (Terminal 1):"
echo -e "   ${YELLOW}docker compose up${NC}\n"
echo "2. Start Backend (Terminal 2):"
echo -e "   ${YELLOW}yarn start:dev${NC}\n"
echo "3. (Optional) Start Hardhat node (Terminal 3):"
echo -e "   ${YELLOW}cd smart-contracts && npm run node${NC}\n"
echo "4. Check health:"
echo -e "   ${YELLOW}curl http://localhost:3000/health${NC}\n"
echo "5. API Docs:"
echo -e "   ${YELLOW}http://localhost:3000/api/docs${NC}\n"

echo -e "${GREEN}Happy coding! 🎉${NC}"
