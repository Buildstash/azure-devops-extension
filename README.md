# Buildstash Azure DevOps Extension

This Azure DevOps extension allows you to upload build artifacts to the Buildstash platform for artifact management.

## Features

- Upload primary build artifacts (binary files)
- Upload optional expansion files
- Support for both direct and chunked uploads
- Comprehensive metadata tracking
- Integration with Azure DevOps pipeline variables

## Installation

1. Package the extension using the Azure DevOps Extension Tools
2. Upload the extension to your Azure DevOps organization
3. Install the extension in your organization

## Usage

Add the "Upload to Buildstash" task to your Azure DevOps pipeline:

```yaml
- task: BuildstashUpload@1
  inputs:
    primaryFilePath: '$(Build.ArtifactStagingDirectory)/my-app.zip'
    expansionFilePath: '$(Build.ArtifactStagingDirectory)/my-app-expansion.zip'
    structure: 'file+expansion'
    apiKey: '$(BUILDSTASH_API_KEY)'
    versionComponent1Major: '1'
    versionComponent2Minor: '0'
    versionComponent3Patch: '0'
    ciPipeline: '$(Build.DefinitionName)'
    ciRunId: '$(Build.BuildId)'
    ciRunUrl: '$(Build.BuildUri)'
    vcHostType: 'Azure Repos'
    vcHost: '$(System.TeamFoundationCollectionUri)'
    vcRepoName: '$(Build.Repository.Name)'
    vcRepoUrl: '$(Build.Repository.Uri)'
    vcBranch: '$(Build.SourceBranch)'
    vcCommitSha: '$(Build.SourceVersion)'
    vcCommitUrl: '$(Build.Repository.Uri)/commit/$(Build.SourceVersion)'
    platform: 'windows'
    stream: 'production'
    notes: 'Build from Azure DevOps pipeline'
```

## Input Parameters

### Required
- **Primary File Path**: Path to the primary build artifact file to upload
- **Structure**: Structure type for the upload (`file` or `file+expansion`)
- **API Key**: Buildstash API key for authentication

### Optional
- **Expansion File Path**: Path to the optional expansion file to upload
- **Version Components**: Major, minor, patch, extra, and meta version components
- **Custom Build Number**: Custom build number
- **CI Information**: Pipeline name, run ID, run URL, build duration
- **Version Control Information**: Host type, host, repository details, branch, commit information
- **Platform**: Platform information
- **Stream**: Stream information
- **Notes**: Additional notes for the upload

## Output Variables

- **buildId**: Build ID returned from Buildstash
- **pendingProcessing**: Whether the build is pending processing
- **buildInfoUrl**: URL to view build information
- **downloadUrl**: URL to download the uploaded artifact

## Example Pipeline

```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: |
    npm install
    npm run build
  displayName: 'Build application'

- task: ArchiveFiles@2
  inputs:
    rootFolderOrFile: 'dist'
    includeRootFolder: false
    archiveType: 'zip'
    archiveFile: '$(Build.ArtifactStagingDirectory)/app.zip'
    replaceExistingArchive: true
  displayName: 'Create artifact archive'

- task: buildstash-task@1
  inputs:
    primaryFilePath: '$(Build.ArtifactStagingDirectory)/app.zip'
    structure: 'file'
    apiKey: '$(BUILDSTASH_API_KEY)'
    versionComponent1Major: '1'
    versionComponent2Minor: '0'
    versionComponent3Patch: '0'
    ciPipeline: '$(Build.DefinitionName)'
    ciRunId: '$(Build.BuildId)'
    ciRunUrl: '$(Build.BuildUri)'
    vcHostType: 'Azure Repos'
    vcHost: '$(System.TeamFoundationCollectionUri)'
    vcRepoName: '$(Build.Repository.Name)'
    vcRepoUrl: '$(Build.Repository.Uri)'
    vcBranch: '$(Build.SourceBranch)'
    vcCommitSha: '$(Build.SourceVersion)'
    vcCommitUrl: '$(Build.Repository.Uri)/commit/$(Build.SourceVersion)'
    platform: 'linux'
    stream: 'production'
    notes: 'Automated build from Azure DevOps'
  displayName: 'Upload to Buildstash'
```

## Development

To develop this extension locally:

1. Install dependencies:
   ```bash
   cd buildstash-task
   npm install
   ```

2. Package the extension:
   ```bash
   npm install -g tfx-cli
   tfx extension create --manifest-globs azure-devops-extension.json
   ```

3. Upload to your organization:
   ```bash
   tfx extension publish --manifest-globs azure-devops-extension.json --token <PAT>
   ```

## License

MIT License 