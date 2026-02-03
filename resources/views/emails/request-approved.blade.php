<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request Approved</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #10b981;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .success-icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 20px;
        }
        .details {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e5e7eb;
        }
        .details-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .details-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: bold;
            color: #6b7280;
        }
        .value {
            color: #111827;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
        }
        .note {
            background-color: #dbeafe;
            border-left: 4px solid #3b82f6;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ Vehicle Request Approved!</h1>
    </div>
    
    <div class="content">
        <div class="success-icon">🎉</div>
        
        <p>Hello <strong>{{ $requesterName }}</strong>,</p>
        
        <p>Great news! Your vehicle request has been approved.</p>
        
        <div class="details">
            <h3 style="margin-top: 0;">Request Details</h3>
            
            <div class="details-row">
                <span class="label">Request ID:</span>
                <span class="value">#{{ $request->id }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Destination:</span>
                <span class="value">{{ $destination }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Date of Travel:</span>
                <span class="value">{{ $dateOfTravel }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Time of Travel:</span>
                <span class="value">{{ $timeOfTravel }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Assigned Vehicle:</span>
                <span class="value">{{ $vehicle }} ({{ $vehiclePlate }})</span>
            </div>
            
            <div class="details-row">
                <span class="label">Assigned Driver:</span>
                <span class="value">{{ $driverName }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Approved By:</span>
                <span class="value">{{ $approvedBy }}</span>
            </div>
            
            <div class="details-row">
                <span class="label">Approved At:</span>
                <span class="value">{{ $approvedAt }}</span>
            </div>
        </div>

        <div class="note">
            <strong>📄 Approved Request Form</strong><br>
            Your approved request form has been attached to this email as a PDF. Please save it for your records.
        </div>
        
        <p>
            <strong>Next Steps:</strong>
        </p>
        <ul>
            <li>A trip ticket will be generated shortly</li>
            <li>You will receive another notification when the trip ticket is ready</li>
            <li>Please keep the attached approved request form for your records</li>
        </ul>
        
        <p>If you have any questions or concerns, please don't hesitate to contact us at <strong>hasperthegreat04@gmail.com</strong>.</p>
    </div>
    
    <div class="footer">
        <p>This is an automated email from the GSU Motorpool Services Request System.</p>
        <p>Please do not reply to this email.</p>
    </div>
</body>
</html>