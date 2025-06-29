const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

async function uploadChunkedFile({
  filePath,
  filesize,
  pendingUploadId,
  chunkedNumberParts,
  chunkedPartSizeMb,
  apiKey,
  isExpansion = false
}) {
  // Read the file at filePath into a buffer
  const chunkSize = chunkedPartSizeMb * 1024 * 1024;
  const parts = [];
  const endpoint = isExpansion
    ? 'https://app.buildstash.com/api/v1/upload/request/multipart/expansion'
    : 'https://app.buildstash.com/api/v1/upload/request/multipart';

  // Loop through each part, get presigned URL, and upload it
  for (let i = 0; i < chunkedNumberParts; i++) {

    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min((i + 1) * chunkSize - 1, filesize - 1);
    let chunkStream = fs.createReadStream(filePath, { start: chunkStart, end: chunkEnd });

    const contentLength = chunkEnd - chunkStart + 1;

    const partNumber = i + 1;

    tl.debug('Uploading chunked upload, part: ' + partNumber + ' of ' + chunkedNumberParts);

    // Request presigned URL for this part
    const presignedResp = await axios.post(
      endpoint,
      {
        pending_upload_id: pendingUploadId,
        part_number: partNumber,
        content_length: contentLength
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get presigned URL for this part from response
    const presignedUrl = presignedResp.data.part_presigned_url;

    // Upload chunk via presigned URL (on failure retry part once before error)
    let uploadResponse;
    let uploadError;
    // Attach error handler to the stream
    chunkStream.on('error', (err) => {
      tl.error(`File stream error for part ${partNumber}: ${err.message}`);
    });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        uploadResponse = await axios.put(
          presignedUrl,
          chunkStream,
          {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': contentLength
            },
            maxBodyLength: Infinity
          }
        );
        uploadError = null;
        break; // Success, exit retry loop
      } catch (err) {
        uploadError = err;
        // Log more error details
        if (err.response) {
          tl.error(`Chunk upload for part ${partNumber} failed (attempt ${attempt}): ${err.message}, status: ${err.response.status}, data: ${JSON.stringify(err.response.data)}`);
        } else {
          tl.error(`Chunk upload for part ${partNumber} failed (attempt ${attempt}): ${err.message}`);
        }
        if (attempt === 1) {
          // Re-create the stream for retry
          chunkStream.destroy();
        }
      }
      // If retrying, re-create the stream
      if (attempt === 1 && uploadError) {
        // Wait a short delay before retrying (optional, can be omitted or tuned)
        await new Promise(res => setTimeout(res, 500));
        // Re-create the stream for the retry
        chunkStream = fs.createReadStream(filePath, { start: chunkStart, end: chunkEnd });
        chunkStream.on('error', (err) => {
          tl.error(`File stream error for part ${partNumber} (retry): ${err.message}`);
        });
      }
    }
    if (uploadError) {
      throw uploadError;
    }
    // Check for ETag presence
    if (!uploadResponse.headers.etag) {
      tl.warning(`No ETag returned for part ${partNumber}. Response headers: ${JSON.stringify(uploadResponse.headers)}`);
    }

    // Add part to parts array
    parts.push({
      PartNumber: partNumber,
      ETag: uploadResponse.headers.etag
    });
  }

  // Return parts array
  return parts;
}

async function run() {
  try {
    // Get inputs
    const primaryFilePath = tl.getPathInput('primaryFilePath', true);
    const expansionFilePath = tl.getPathInput('expansionFilePath');
    const structure = tl.getInput('structure', true);
    const apiKey = tl.getInput('apiKey', true);

    // Verify primary file exists
    if (!fs.existsSync(primaryFilePath)) {
      throw new Error(`Primary file not found at path: ${primaryFilePath}`);
    }

    // Get primary file stats
    const primaryStats = fs.statSync(primaryFilePath);
    const primaryFilename = path.basename(primaryFilePath);

    // Prepare request payload
    const payload = {
      structure: structure,
      primary_file: {
        filename: primaryFilename,
        size_bytes: primaryStats.size
      },
      version_component_1_major: tl.getInput('versionComponent1Major'),
      version_component_2_minor: tl.getInput('versionComponent2Minor'),
      version_component_3_patch: tl.getInput('versionComponent3Patch'),
      version_component_extra: tl.getInput('versionComponentExtra'),
      version_component_meta: tl.getInput('versionComponentMeta'),
      custom_build_number: tl.getInput('customBuildNumber'),
      source: 'azure-devops',
      ci_pipeline: tl.getInput('ciPipeline'),
      ci_run_id: tl.getInput('ciRunId'),
      ci_run_url: tl.getInput('ciRunUrl'),
      ci_build_duration: tl.getInput('ciBuildDuration'),
      vc_host_type: tl.getInput('vcHostType'),
      vc_source_host: tl.getInput('vcSourceHost'),
      vc_repo_name: tl.getInput('vcRepoName'),
      vc_repo_url: tl.getInput('vcRepoUrl'),
      vc_branch: tl.getInput('vcBranch'),
      vc_commit_sha: tl.getInput('vcCommitSha'),
      vc_commit_url: tl.getInput('vcCommitUrl'),
      platform: tl.getInput('platform'),
      stream: tl.getInput('stream'),
      notes: tl.getInput('notes')
    };

    // Add expansion file info if structure is file+expansion and expansion file path provided
    if (structure === 'file+expansion' && expansionFilePath) {
      // Verify expansion file exists
      if (!fs.existsSync(expansionFilePath)) {
        throw new Error(`Expansion file not found at path: ${expansionFilePath}`);
      }

      // Get expansion file stats
      const expansionStats = fs.statSync(expansionFilePath);
      const expansionFilename = path.basename(expansionFilePath);

      payload.expansion_files = [{
        filename: expansionFilename,
        size_bytes: expansionStats.size
      }];
    }

    // Initial request to get upload URLs
    const uploadRequest = await axios.post(
      'https://app.buildstash.com/api/v1/upload/request',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { pending_upload_id, primary_file, expansion_files } = uploadRequest.data;
    let primaryFileParts = null;
    let expansionFileParts = null;

    // Handle primary file upload
    if (primary_file.chunked_upload) {
      tl.debug('Uploading primary file using chunked upload...');
      primaryFileParts = await uploadChunkedFile({
        filePath: primaryFilePath,
        filesize: primaryStats.size,
        pendingUploadId: pending_upload_id,
        chunkedNumberParts: primary_file.chunked_number_parts,
        chunkedPartSizeMb: primary_file.chunked_part_size_mb,
        apiKey,
        isExpansion: false
      });
    } else {
      tl.debug('Uploading primary file using direct upload...');
      await axios.put(
        primary_file.presigned_data.url,
        fs.createReadStream(primaryFilePath),
        {
          headers: {
            'Content-Type': primary_file.presigned_data.headers['Content-Type'],
            'Content-Length': primary_file.presigned_data.headers['Content-Length'],
            'Content-Disposition': primary_file.presigned_data.headers['Content-Disposition'],
            'x-amz-acl': 'private'
          },
          maxBodyLength: Infinity
        }
      );
    }

    // Handle expansion file upload if present
    if (expansionFilePath && expansion_files && expansion_files[0]) {
      if (expansion_files[0].chunked_upload) {
        tl.debug('Uploading expansion file using chunked upload...');
        expansionFileParts = await uploadChunkedFile({
          filePath: expansionFilePath,
          filesize: expansionStats.size,
          pendingUploadId: pending_upload_id,
          chunkedNumberParts: expansion_files[0].chunked_number_parts,
          chunkedPartSizeMb: expansion_files[0].chunked_part_size_mb,
          apiKey,
          isExpansion: true
        });
      } else {
        tl.debug('Uploading expansion file using direct upload...');
        await axios.put(
          expansion_files[0].presigned_data.url,
          fs.createReadStream(expansionFilePath),
          {
            headers: {
              'Content-Type': expansion_files[0].presigned_data.headers['Content-Type'],
              'Content-Length': expansion_files[0].presigned_data.headers['Content-Length'],
              'Content-Disposition': expansion_files[0].presigned_data.headers['Content-Disposition'],
              'x-amz-acl': 'private'
            },
            maxBodyLength: Infinity
          }
        );
      }
    }

    // Verify upload
    tl.debug('Verifying upload...');
    const verifyPayload = { pending_upload_id };
    
    if (primaryFileParts) {
      verifyPayload.multipart_chunks = primaryFileParts;
    }
    
    if (expansionFileParts) {
      if (!verifyPayload.multipart_chunks) verifyPayload.multipart_chunks = [];
      verifyPayload.multipart_chunks = verifyPayload.multipart_chunks.concat(expansionFileParts);
    }

    const verifyResponse = await axios.post(
      'https://app.buildstash.com/api/v1/upload/verify',
      verifyPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the values from the response
    const buildId = verifyResponse.data.build_id;
    const pendingProcessing = verifyResponse.data.pending_processing;
    const buildInfoUrl = verifyResponse.data.build_info_url;
    const downloadUrl = verifyResponse.data.download_url;

    // Set the outputs using the Azure DevOps task library
    tl.setVariable('buildId', buildId);
    tl.setVariable('pendingProcessing', pendingProcessing);
    tl.setVariable('buildInfoUrl', buildInfoUrl);
    tl.setVariable('downloadUrl', downloadUrl);

    tl.debug('Upload completed and verified successfully! Uploaded build id ' + buildId);
    
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, error.message);
    if (error.response) {
      tl.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

run(); 