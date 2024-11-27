# Use Node.js LTS image
FROM node:16

RUN useradd -m appuser
USER appuser

# Set working directory
WORKDIR /app

# Copy package.json and lock files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Hardhat's default port
EXPOSE 8545

# Command to start Hardhat node
CMD ["npx", "hardhat", "node"]
