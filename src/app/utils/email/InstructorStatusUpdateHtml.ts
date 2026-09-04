import type { AdminApprovalStatus } from '@prisma/client';

export const InstructorStatusUpdateHtml = (
  userName: string,
  status: AdminApprovalStatus,
) => {
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';

  const statusColor = isApproved ? '#16a34a' : isRejected ? '#dc2626' : '#d97706';
  const statusBg = isApproved ? '#f0fdf4' : isRejected ? '#fef2f2' : '#fffbeb';
  const statusBorder = isApproved ? '#bbf7d0' : isRejected ? '#fecaca' : '#fef08a';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Instructor Application Status Update</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f7; color: #333333;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
      <!-- Header -->
      <tr>
        <td style="background-color: #62286C; padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">
            Career <span style="color: #e9d5ff;">IT</span>
          </h1>
          <p style="color: #f3e8ff; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
            Instructor Portal
          </p>
        </td>
      </tr>

      <!-- Body Content -->
      <tr>
        <td style="padding: 30px 25px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">
            Hello ${userName},
          </h2>
          
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
            We have an update regarding your instructor account application on <strong>Career IT</strong>.
          </p>

          <!-- Status Box -->
          <div style="background-color: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px;">
            <span style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 1px; display: block; margin-bottom: 5px;">
              Application Status
            </span>
            <span style="font-size: 22px; font-weight: 800; color: ${statusColor}; text-transform: uppercase; letter-spacing: 1px;">
              ${status}
            </span>
          </div>

          <!-- Description Message -->
          ${
            isApproved
              ? `
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              🎉 <strong>Congratulations!</strong> Your instructor profile has been reviewed and approved by our administration team.
            </p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              You can now log in to your dashboard, build IT courses, create milestones, and start publishing content for students worldwide.
            </p>
            <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
              <a href="https://career-it.com/login" style="background-color: #62286C; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 10px; display: inline-block; font-size: 14px;">
                Go to Instructor Dashboard
              </a>
            </div>
            `
              : isRejected
              ? `
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              We regret to inform you that your application to become an instructor on Career IT has not been approved at this time.
            </p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              If you believe this decision was made in error or would like to update your credentials, please feel free to reach out to our support team.
            </p>
            `
              : `
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              Your instructor application is currently under review. Our team will notify you once a decision has been made.
            </p>
            `
          }

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />

          <!-- Footer -->
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from Career IT. Please do not reply to this email.
          </p>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 5px 0 0 0;">
            &copy; ${new Date().getFullYear()} Career IT Platform. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
