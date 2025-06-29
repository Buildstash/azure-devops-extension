# Buildstash Azure DevOps Extension

This Azure DevOps extension allows you to upload build artifacts to Buildstash.

Buildstash is a platform for software teams to manage all their past builds, organize, share with team members, and steer through to deployment or publishing. 

## Features

- Upload software builds, for any platform
- Attach associated metadata to builds - such as git commit, Azure Pipelines run data, etc
- Once stored in Buildstash, builds can be be powerfully organized, shared, and more

## Installation

Install the extension to your Azure DevOps organization via the marketplace at https://marketplace.visualstudio.com/items?itemName=Buildstash.buildstash-tasks

Add the Buildstash upload task to your pipeline script, using the example below.

Add the application specific API key as a secret variable for your pipeline, with name BUILDSTASH_API_KEY.

Note: You will need to have an active Buildstash account and API key for your application, sign up at [buildstash.com](https://buildstash.com)

## Usage

Add the "Upload to Buildstash" task to your Azure DevOps pipeline:

```yaml
- task: BuildstashUpload@1
    displayName: Upload to Buildstash
    inputs:
      apiKey: $(BUILDSTASH_API_KEY)
      structure: 'file'
      primaryFilePath: 'example.exe'
      versionComponent1Major: '1'
      versionComponent2Minor: '0'
      versionComponent3Patch: '1'
      versionComponentExtra: 'beta'
      versionComponentMeta: '2024.12.02'
      customBuildNumber: '12345'
      platform: 'windows'
      stream: 'default'

      # Optional CI info
      ciPipeline: $(Build.DefinitionName)
      ciRunId: $(Build.BuildId)
      ciRunUrl: "$(System.TeamFoundationCollectionUri)$(System.TeamProject)/_build/results?buildId=$(Build.BuildId)"

      # Optional VC info
      vcHostType: 'git'
      vcHost: 'github'
      vcRepoName: $(Build.Repository.Name)
      vcRepoUrl: $(Build.Repository.Uri)
      vcBranch: $(Build.SourceBranchName)
      vcCommitSha: $(Build.SourceVersion)
      vcCommitUrl: $(Build.Repository.Uri)/commit/$(Build.SourceVersion)
```

## Input Parameters

### Required
- **Primary File Path**: Path to the primary build artifact file to upload
- **Structure**: Structure type for the upload (`file` or `file+expansion`)
- **API Key**: Buildstash API key for authentication (should be passed in as a secret variable)

### Optional
- **Expansion File Path**: Path to the optional expansion file to upload (can be used to upload Android .obb files with a primary .apk)
- **Version Components**: Major, minor, patch version components, with optional extra and meta components
- **Custom Build Number**: Custom build number, in any preferred format
- **CI Information**: Pipeline name, run ID, run URL, build duration
- **Version Control Information**: Host type, host, repository details, branch, commit information
- **Platform**: Platform name (must exactly match platform slug attached to your app)
- **Stream**: Stream name (must exactly match)
- **Notes**: Optional build notes
