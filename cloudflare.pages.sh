#!/bin/bash

# Configure SSH for submodules
mkdir -p ~/.ssh
echo "$SSH_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

# Configure git to use SSH instead of HTTPS
git config --global url."git@github.com:".insteadOf "https://github.com/"

# Update and initialize submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Copy contract files explicitly (in case prebuild doesn't run)
echo "Copying contract files..."
npx tsx scripts/copy-to-public.ts

# Build the project
npm run build