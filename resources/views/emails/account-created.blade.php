@component('mail::message')
# Welcome to GSU Motorpool Services

Hello **{{ $user->name }}**,

Your account has been created for the GSU Motorpool Services Request System. You can now submit vehicle requests and track their status.

## Your Login Credentials

**Email:** {{ $user->email }}  
**Temporary Password:** `{{ $temporaryPassword }}`

@component('mail::button', ['url' => route('login')])
Login to Your Account
@endcomponent

## Important Security Notice

⚠️ **Please change your password immediately after your first login** for security purposes.

## Your Account Details

- **Department:** {{ $user->department }}
- **Position:** {{ $user->position }}
- **Role:** Client

## What You Can Do

With your new account, you can:
- Submit vehicle requests online
- Track request status in real-time
- View your trip history
- Receive notifications about your requests

## Need Help?

If you have any questions or need assistance, please contact:
- **General Services Unit**
- **Email:** hasperthegreat04@gmail.com

---

Thank you,  
**GSU Motorpool Management**

@component('mail::subcopy')
If you did not request this account, please contact the administrator immediately at hasperthegreat04@gmail.com
@endcomponent
@endcomponent