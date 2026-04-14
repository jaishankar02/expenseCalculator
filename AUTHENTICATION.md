# HishabChecker - Authentication System

## Overview
The HishabChecker app now includes a complete authentication system using JWT (JSON Web Tokens) where users are uniquely identified by their phone number.

## Features

### 1. **User Authentication**
- **Signup**: Create a new account using:
  - Name
  - Phone Number (unique identifier)
  - Email (optional)
  - Password (hashed using bcryptjs)

- **Login**: Authenticate using:
  - Phone Number
  - Password

### 2. **User Management**
- **Find Users**: Search for other users by their phone number
- **Add Friends**: Build your friend list to split expenses with
- **Unique Phone-based ID**: Each user is uniquely identified by their phone number

### 3. **User-Specific Expenses**
- All expenses are now tied to the logged-in user
- Each user sees only their expenses and those involving their friends
- Friend list manages who can see your expenses

## How to Use

### Starting the App

1. **Start the MongoDB connection** (should be running):
   - MongoDB Atlas is configured in the `.env` file

2. **Start the server**:
   ```bash
   cd server
   npm start
   # Server runs on http://localhost:3001
   ```

3. **Start the frontend**:
   ```bash
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

### First-Time User Flow

1. **Sign Up Page**
   - Click "Sign up" on the login page
   - Enter your name, phone number, email (optional), and password
   - Click "Create Account"
   - You'll be automatically logged in

2. **Add Friends**
   - Use the "Add Friends" section at the top of the dashboard
   - Enter your friend's phone number
   - Click "Search"
   - Click "Add Friend" to add them to your expense group

3. **Create Expenses**
   - Select "Who Paid?" (the payer)
   - Select "Split Between" (beneficiaries)
   - The app automatically calculates who owes whom

## Backend API Endpoints

### Authentication Routes
- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/login` - Login with phone and password
- `GET /api/auth/me` - Get current user info (requires token)

### User Routes
- `GET /api/users/search/:phone` - Search for a user by phone (requires token)
- `POST /api/users/add-friend` - Add a friend (requires token)

### People Routes (Authenticated)
- `GET /api/people` - Get your friends list
- `POST /api/people` - Add a new person
- `DELETE /api/people/:id` - Remove a person

### Expense Routes (Authenticated)
- `GET /api/expenses` - Get your expenses
- `POST /api/expenses` - Create an expense
- `DELETE /api/expenses/:id` - Delete an expense

## Data Storage

### User Model
```javascript
{
  name: String,
  phone: String (unique),
  email: String (unique),
  password: String (hashed),
  friends: [ObjectId],
  timestamp: Number
}
```

### Expense Model
```javascript
{
  description: String,
  amount: Number,
  payerId: ObjectId,
  beneficiaryIds: [ObjectId],
  date: String,
  groupId: String,
  timestamp: Number
}
```

## Security Features

1. **Password Encryption**: All passwords are hashed using bcryptjs
2. **JWT Tokens**: Secure token-based authentication
3. **Token Expiration**: Tokens expire after 7 days
4. **Phone Number Uniqueness**: Can't have duplicate phone numbers
5. **Protected Routes**: All data routes require valid JWT token

## Environment Variables

The `.env` file in the server directory contains:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT (change in production!)
- `PORT` - Server port (default: 3001)

## Known Limitations & Future Improvements

1. **Phone-based uniqueness**: Currently relies on phone number as unique identifier
2. **No phone verification**: Phone numbers are not verified
3. **No password reset**: Users must remember their password
4. **No profile pictures**: User profiles don't include pictures
5. **Limited friend management**: No friend removal yet
6. **No groups**: All friends are in one global friend list

## Troubleshooting

### "User not found" on Login
- Make sure you registered first using the Sign Up page
- Check if phone number is correct

### "Phone number already registered"
- The phone number is already in use
- Try with a different phone number

### Server Connection Error
- Make sure the backend server is running on port 3001
- Check MongoDB connection in `.env`

### Token Expired
- Simply log in again to get a new token

## Future Enhancements

1. Add phone number verification via OTP
2. Password reset functionality
3. User profile pictures
4. Group expense splitting
5. Payment settlement integration
6. Export expense reports
7. Recurring expenses
8. Expense categories
