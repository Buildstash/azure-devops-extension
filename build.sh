#!/bin/bash

# Build script for Buildstash Azure DevOps Extension

echo "Building Buildstash Azure DevOps Extension..."

# Install dependencies for the task
echo "Installing task dependencies..."
cd tasks/BuildstashUpload
npm install
cd ..

# Install tfx-cli if not already installed
if ! command -v tfx &> /dev/null; then
    echo "Installing tfx-cli..."
    npm install -g tfx-cli
fi

# Create the extension package
echo "Creating extension package..."
tfx extension create --manifest-globs azure-devops-extension.json

echo "Build complete! Extension package created."
echo ""
echo "To publish the extension:"
echo "1. Update the publisher in azure-devops-extension.json to your publisher ID"
echo "2. Run: tfx extension publish --manifest-globs azure-devops-extension.json --token <YOUR_PAT>"
echo ""
echo "To install locally for testing:"
echo "Run: tfx extension install --manifest-globs azure-devops-extension.json --token <YOUR_PAT>" 