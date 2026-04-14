# Jest Test Suite Documentation

## Overview
This comprehensive Jest test suite provides complete unit test coverage for the Node.js MongoDB user management application routes. All tests run in isolation using mocked dependencies, ensuring no database connection is required.

## Test Structure

### File Location
`routes/routes.test.js`

### Key Features
- **Complete mocking** of the User Mongoose model using `jest.mock()`
- **Multer middleware** mocked for file upload testing
- **File system operations** mocked to prevent actual file I/O
- **Express session** mocked for session message testing
- **27 comprehensive tests** covering all CRUD operations

## Test Coverage

### 1. POST /add - User Creation (11 tests)

#### Success Scenario (3 tests)
- ✓ Create new user with all required fields (name, email, phone)
- ✓ Create user without image file (defaults to 'user_unknown.png')
- ✓ Create user with uploaded image file

#### Edge Cases - Missing Fields (4 tests)
- ✓ Handle missing `name` field
- ✓ Handle missing `email` field
- ✓ Handle missing `phone` field
- ✓ Handle completely empty request body

#### Edge Cases - Data Validation (4 tests)
- ✓ Handle duplicate email error (MongoDB E11000)
- ✓ Handle database connection errors
- ✓ Handle invalid email format error
- ✓ Handle invalid phone format error

### 2. GET / - Fetch Users (5 tests)

- ✓ Fetch users with default pagination (page=1, limit=10)
- ✓ Fetch users with custom page and limit parameters
- ✓ Handle search functionality with regex pattern matching
- ✓ Handle sorting by different fields (name, email, etc.) in ascending/descending order
- ✓ Handle database errors during user retrieval

### 3. GET /edit/:id - Get User for Editing (3 tests)

- ✓ Fetch user for editing when user exists
- ✓ Redirect when user does not exist
- ✓ Handle database errors

### 4. POST /update/:id - Update User (3 tests)

- ✓ Update user successfully without new image
- ✓ Update user with new image and delete old image file
- ✓ Handle database errors during update

### 5. DELETE /delete/:id - Delete User (5 tests)

- ✓ Delete user successfully
- ✓ Delete user and associated image file
- ✓ Redirect when user not found
- ✓ Handle database errors
- ✓ Handle image file deletion errors gracefully

## Mocking Strategy

### User Model Mock
```javascript
jest.mock('../models/users');
const User = require('../models/users');

// Example usage:
User.mockImplementation(() => ({
  save: jest.fn().mockResolvedValue(newUser)
}));
```

**Mocked Methods:**
- `User.save()` - Mock for creating users
- `User.find()` - Mock for querying users
- `User.findById()` - Mock for fetching single user
- `User.findByIdAndUpdate()` - Mock for updating users
- `User.findByIdAndDelete()` - Mock for deleting users
- `User.countDocuments()` - Mock for pagination

### Multer Mock
```javascript
jest.mock('multer', () => {
  const mockMulter = (options) => ({
    single: () => (req, res, next) => {
      req.file = req.mockFile || null;
      next();
    }
  });
  mockMulter.diskStorage = jest.fn(() => ({}));
  return mockMulter;
});
```

**Features:**
- Prevents actual file system writes during tests
- Allows mocking file upload scenarios
- Properly handles absence of uploaded files

### File System Mock
```javascript
jest.mock('fs');
const fs = require('fs');

// All fs operations are mocked - no real files are deleted
fs.unlinkSync = jest.fn();
```

### Express Response Mock
```javascript
res.render = jest.fn((view, data) => {
  res.status(200).json({ view, data });
});
```

## Running the Tests

```bash
# Run all tests in the routes.test.js file
npm test -- routes/routes.test.js

# Run with verbose output
npm test -- routes/routes.test.js --verbose

# Run with coverage report
npm test -- routes/routes.test.js --coverage

# Watch mode (re-run on file changes)
npm test -- routes/routes.test.js --watch
```

## Test Output

All 27 tests pass successfully:
- ✓ **27 passed** - All tests passing
- ✓ **0 failed** - No failures
- ✓ **1 test suite** - Single file (routes.test.js)
- ✓ **No snapshots** - Snapshot testing not used
- ✓ **Execution time** - ~1.6 seconds

## Key Testing Patterns Used

### 1. Mock Implementation
```javascript
User.mockImplementation(() => ({
  save: jest.fn().mockResolvedValue(newUser)
}));
```

### 2. Mock Resolution
```javascript
User.findById = jest.fn().mockResolvedValue(mockUser);
```

### 3. Mock Rejection (Error Handling)
```javascript
User.save = jest.fn().mockRejectedValue(new Error('Validation failed'));
```

### 4. Mock Call Assertions
```javascript
expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
expect(fs.unlinkSync).toHaveBeenCalledWith('./uploads/image.jpg');
```

## Benefits of This Test Suite

1. **Isolation** - No database connection required; tests run in milliseconds
2. **Reliability** - Deterministic results without external dependencies
3. **Comprehensive** - Covers happy paths, edge cases, and error scenarios
4. **Maintainability** - Clear test names and organized test groups
5. **CI/CD Ready** - Can run in automated pipelines without setup
6. **Documentation** - Tests serve as live documentation of expected behavior

## Edge Cases Covered

- Missing required fields (name, email, phone)
- MongoDB duplicate key errors (E11000)
- Database connection failures
- Invalid data format errors
- File system operation failures
- Non-existent resource requests
- Pagination boundary conditions
- Search and filter functionality
- Sorting in ascending and descending order

## Notes

- The console message "Error deleting image: File not found" is expected behavior - it reflects the route's error handling for file deletion failures
- All file I/O is mocked, so no actual files are created or deleted during testing
- Session management is mocked through express-session in tests
- The test app properly simulates Express middleware chain execution
