/**
 * Google Workspace APIs Client Service (Drive, Gmail, Forms, Tasks)
 * Pure Client-side Bearer Token Authentication
 */

// ----------------------------------------------------
// 1. Google Drive API
// ----------------------------------------------------
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  size?: string;
  modifiedTime?: string;
}

export async function listDriveFiles(accessToken: string, searchPrefix?: string): Promise<DriveFileItem[]> {
  let query = "trashed = false";
  if (searchPrefix) {
    query += ` and name contains '${searchPrefix.replace(/'/g, "\\'")}'`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime)&pageSize=30&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function uploadTextFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<DriveFileItem> {
  const metadata = {
    name: fileName,
    mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload file to Google Drive: ${err}`);
  }

  return await res.json();
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete file from Google Drive: ${err}`);
  }

  return true;
}

// ----------------------------------------------------
// 2. Gmail API
// ----------------------------------------------------
export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
}

export async function listGmailMessages(accessToken: string, queryStr?: string): Promise<GmailMessageSummary[]> {
  let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15';
  if (queryStr) {
    url += `&q=${encodeURIComponent(queryStr)}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${err}`);
  }

  const listData = await res.json();
  const messages = listData.messages || [];

  // Fetch individual message details for top messages
  const messageDetails: GmailMessageSummary[] = await Promise.all(
    messages.slice(0, 10).map(async (msg: { id: string; threadId: string }) => {
      try {
        const itemRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!itemRes.ok) return { id: msg.id, threadId: msg.threadId };
        const data = await itemRes.json();
        const headers = data.payload?.headers || [];
        const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value;
        const fromHeader = headers.find((h: any) => h.name === 'From')?.value;
        const toHeader = headers.find((h: any) => h.name === 'To')?.value;
        const dateHeader = headers.find((h: any) => h.name === 'Date')?.value;

        return {
          id: data.id,
          threadId: data.threadId,
          snippet: data.snippet,
          subject: subjectHeader || '(No Subject)',
          from: fromHeader || 'Unknown',
          to: toHeader,
          date: dateHeader,
        };
      } catch {
        return { id: msg.id, threadId: msg.threadId };
      }
    })
  );

  return messageDetails;
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<{ id: string; threadId: string }> {
  // Construct RFC 2822 email format
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyText,
  ];
  const message = messageParts.join('\r\n');

  // Base64url encoding
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send email via Gmail API: ${err}`);
  }

  return await res.json();
}

// ----------------------------------------------------
// 3. Google Forms API
// ----------------------------------------------------
export interface GoogleFormItem {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export async function listGoogleForms(accessToken: string): Promise<GoogleFormItem[]> {
  const query = "mimeType = 'application/vnd.google-apps.form' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=25&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list Google Forms: ${err}`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function createGoogleForm(
  accessToken: string,
  title: string,
  description: string
): Promise<{ formId: string; responderUri: string }> {
  // Step 1: Create the empty form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Form: ${err}`);
  }

  const form = await createRes.json();
  const formId = form.formId;

  // Step 2: Add description and sample intake questions
  const updatePayload = {
    requests: [
      {
        updateFormInfo: {
          info: {
            description,
          },
          updateMask: 'description',
        },
      },
      {
        createItem: {
          item: {
            title: 'Full Applicant Name / Business Name',
            questionItem: {
              question: {
                required: true,
                textQuestion: {},
              },
            },
          },
          location: { index: 0 },
        },
      },
      {
        createItem: {
          item: {
            title: 'Application Reference ID or Mobile Number',
            questionItem: {
              question: {
                required: true,
                textQuestion: {},
              },
            },
          },
          location: { index: 1 },
        },
      },
      {
        createItem: {
          item: {
            title: 'Service Requested',
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [
                    { value: 'PAN Card / Correction Assistance' },
                    { value: 'Udyam MSME Registration' },
                    { value: 'GST Registration / Verification' },
                    { value: 'Gazette Name Change Filing' },
                    { value: 'Other Digital Service' },
                  ],
                },
              },
            },
          },
          location: { index: 2 },
        },
      },
    ],
  };

  try {
    await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });
  } catch (err) {
    console.warn('Form created, but initial question batchUpdate failed:', err);
  }

  return {
    formId,
    responderUri: form.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
  };
}

export async function getFormResponses(accessToken: string, formId: string): Promise<any[]> {
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to retrieve form responses: ${err}`);
  }

  const data = await res.json();
  return data.responses || [];
}

// ----------------------------------------------------
// 4. Google Tasks API
// ----------------------------------------------------
export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

export async function listGoogleTasks(accessToken: string, tasklistId: string = '@default'): Promise<GoogleTaskItem[]> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks?showCompleted=true&showHidden=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Tasks API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function createGoogleTask(
  accessToken: string,
  title: string,
  notes?: string,
  due?: string,
  tasklistId: string = '@default'
): Promise<GoogleTaskItem> {
  const payload: any = { title };
  if (notes) payload.notes = notes;
  if (due) payload.due = due;

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Google Task: ${err}`);
  }

  return await res.json();
}

export async function completeGoogleTask(
  accessToken: string,
  taskId: string,
  tasklistId: string = '@default'
): Promise<GoogleTaskItem> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'completed',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to complete task: ${err}`);
  }

  return await res.json();
}

export async function deleteGoogleTask(
  accessToken: string,
  taskId: string,
  tasklistId: string = '@default'
): Promise<boolean> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${tasklistId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete Google Task: ${err}`);
  }

  return true;
}
