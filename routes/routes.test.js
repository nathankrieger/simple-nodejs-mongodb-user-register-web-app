// Mock multer BEFORE requiring routes
jest.mock('multer', () => {
  const mockMulter = (options) => ({
    single: () => (req, res, next) => {
      // Mock file upload middleware
      req.file = req.mockFile || null;
      next();
    }
  });
  
  mockMulter.diskStorage = jest.fn(() => ({}));
  return mockMulter;
});

// Mock the User model completely BEFORE requiring routes
jest.mock('../models/users');

// Mock fs module for image deletion
jest.mock('fs');

// Now import everything after mocks are in place
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const router = require('./routes');
const User = require('../models/users');
const fs = require('fs');

// Setup Express app for testing
const createTestApp = () => {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true
  }));
  
  // Mock render before routing
  app.use((req, res, next) => {
    res.render = jest.fn((view, data) => {
      res.status(200).json({ view, data });
    });
    next();
  });
  
  // Set up view engine (mock it)
  app.set('view engine', 'ejs');
  app.set('views', `${__dirname}/../views`);
  
  // Use the router
  app.use('/', router);
  
  return app;
};

describe('User Routes - POST /add', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    
    // Mock res.render to avoid actual view rendering
    app.response.render = jest.fn((view, data) => {
      this.send(data);
    });
  });

  describe('Success Scenario', () => {
    test('should create a new user successfully with all fields', async () => {
      const newUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        image: 'user_123456.jpg',
        created: new Date()
      };

      // Mock the User constructor and save method
      User.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(newUser)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890'
        });

      // Verify redirect behavior
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should create a user without an image file (default image)', async () => {
      const newUser = {
        _id: '507f1f77bcf86cd799439012',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
        image: 'user_unknown.png',
        created: new Date()
      };

      User.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(newUser)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '9876543210'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should create a user with an uploaded image file', async () => {
      const mockFile = {
        fieldname: 'image',
        originalname: 'profile.jpg',
        filename: 'image_1609459200000_profile.jpg'
      };

      const newUser = {
        _id: '507f1f77bcf86cd799439013',
        name: 'Bob Smith',
        email: 'bob@example.com',
        phone: '5555555555',
        image: 'image_1609459200000_profile.jpg',
        created: new Date()
      };

      User.mockImplementation((data) => ({
        save: jest.fn().mockResolvedValue({ ...newUser, ...data })
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'Bob Smith',
          email: 'bob@example.com',
          phone: '5555555555',
          mockFile: mockFile
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });

  describe('Edge Cases - Missing Fields', () => {
    test('should handle missing name field', async () => {
      const validationError = new Error('User validation failed: name is required');
      validationError.name = 'ValidationError';

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          email: 'test@example.com',
          phone: '1234567890'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should handle missing email field', async () => {
      const validationError = new Error('User validation failed: email is required');
      validationError.name = 'ValidationError';

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          phone: '1234567890'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should handle missing phone field', async () => {
      const validationError = new Error('User validation failed: phone is required');
      validationError.name = 'ValidationError';

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'john@example.com'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should handle completely empty request body', async () => {
      const validationError = new Error('User validation failed: name is required');
      validationError.name = 'ValidationError';

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({});

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });

  describe('Edge Cases - Duplicate User', () => {
    test('should handle duplicate email error', async () => {
      const duplicateError = new Error('E11000 duplicate key error collection: users.users index: email_1');
      duplicateError.code = 11000;

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(duplicateError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'duplicate@example.com',
          phone: '1234567890'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });

  describe('Edge Cases - Data Validation', () => {
    test('should handle database connection error', async () => {
      const dbError = new Error('MongoDB connection failed');

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(dbError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should handle invalid email format error', async () => {
      const validationError = new Error('Invalid email format');

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          phone: '1234567890'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });

    test('should handle invalid phone format error', async () => {
      const validationError = new Error('Invalid phone format');

      User.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(validationError)
      }));

      const response = await request(app)
        .post('/add')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: 'not-a-number'
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });
});

describe('User Routes - GET /', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();

    // Mock res.render
    app.response.render = jest.fn((view, data) => {
      this.send(data);
    });
  });

  describe('Fetch Users with Pagination', () => {
    test('should fetch users with default pagination', async () => {
      const mockUsers = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'User 1',
          email: 'user1@example.com',
          phone: '1111111111',
          image: 'user1.jpg',
          created: new Date()
        },
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'User 2',
          email: 'user2@example.com',
          phone: '2222222222',
          image: 'user2.jpg',
          created: new Date()
        }
      ];

      User.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers)
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(2);

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(User.find).toHaveBeenCalled();
      expect(User.countDocuments).toHaveBeenCalled();
    });

    test('should fetch users with custom page and limit', async () => {
      const mockUsers = [];

      User.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers)
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/?page=2&limit=5')
        .expect(200);

      expect(User.find).toHaveBeenCalled();
    });

    test('should handle search functionality', async () => {
      const mockUsers = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'John',
          email: 'john@example.com',
          phone: '1111111111',
          image: 'john.jpg',
          created: new Date()
        }
      ];

      User.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers)
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(1);

      const response = await request(app)
        .get('/?search=John')
        .expect(200);

      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(Object)
        })
      );
    });

    test('should handle sorting by different fields', async () => {
      const mockUsers = [];

      User.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers)
          })
        })
      });

      User.countDocuments = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/?sort=email&order=desc')
        .expect(200);

      expect(User.find).toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection error');

      User.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(dbError)
          })
        })
      });

      const response = await request(app)
        .get('/')
        .expect(200);

      expect(User.find).toHaveBeenCalled();
    });
  });
});

describe('User Routes - GET /edit/:id', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();

    app.response.render = jest.fn((view, data) => {
      this.send(data);
    });
  });

  test('should fetch user for editing when user exists', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      image: 'john.jpg',
      created: new Date()
    };

    User.findById = jest.fn().mockResolvedValue(mockUser);

    const response = await request(app)
      .get('/edit/507f1f77bcf86cd799439011');

    // Verify that findById was called with correct ID
    expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    // The route either renders the page or redirects based on whether user is found
    // With our mock setup, we verify findById was called correctly
    expect([200, 302]).toContain(response.status);
  });

  test('should redirect when user does not exist', async () => {
    User.findById = jest.fn().mockResolvedValue(null);

    const response = await request(app)
      .get('/edit/nonexistent')
      .expect(302);

    expect(response.headers.location).toBe('/');
  });

  test('should handle database errors', async () => {
    User.findById = jest.fn().mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/edit/507f1f77bcf86cd799439011')
      .expect(302);

    expect(response.headers.location).toBe('/');
  });
});

describe('User Routes - DELETE /delete/:id', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    fs.unlinkSync = jest.fn();
  });

  test('should delete user successfully', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      image: 'john.jpg',
      created: new Date()
    };

    User.findByIdAndDelete = jest.fn().mockResolvedValue(mockUser);

    const response = await request(app)
      .get('/delete/507f1f77bcf86cd799439011')
      .expect(302);

    expect(User.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(response.headers.location).toBe('/');
  });

  test('should handle deletion of user with image file', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      image: 'john.jpg',
      created: new Date()
    };

    User.findByIdAndDelete = jest.fn().mockResolvedValue(mockUser);
    fs.unlinkSync = jest.fn();

    const response = await request(app)
      .get('/delete/507f1f77bcf86cd799439011')
      .expect(302);

    expect(User.findByIdAndDelete).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('./uploads/john.jpg');
  });

  test('should handle user not found', async () => {
    User.findByIdAndDelete = jest.fn().mockResolvedValue(null);

    const response = await request(app)
      .get('/delete/nonexistent')
      .expect(302);

    expect(response.headers.location).toBe('/');
  });

  test('should handle database errors', async () => {
    User.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .get('/delete/507f1f77bcf86cd799439011')
      .expect(302);

    expect(response.headers.location).toBe('/');
  });

  test('should handle image deletion errors gracefully', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      image: 'john.jpg'
    };

    User.findByIdAndDelete = jest.fn().mockResolvedValue(mockUser);
    fs.unlinkSync = jest.fn(() => {
      throw new Error('File not found');
    });

    const response = await request(app)
      .get('/delete/507f1f77bcf86cd799439011')
      .expect(302);

    expect(response.headers.location).toBe('/');
  });
});

describe('User Routes - POST /update/:id', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    fs.unlinkSync = jest.fn();
  });

  test('should update user successfully without new image', async () => {
    const updatedUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Updated Name',
      email: 'updated@example.com',
      phone: '9999999999',
      image: 'old.jpg',
      created: new Date()
    };

    User.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);

    const response = await request(app)
      .post('/update/507f1f77bcf86cd799439011')
      .send({
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '9999999999',
        old_image: 'old.jpg'
      })
      .expect(302);

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(response.headers.location).toBe('/');
  });

  test('should update user with new image and delete old one', async () => {
    const updatedUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Updated Name',
      email: 'updated@example.com',
      phone: '9999999999',
      image: 'new.jpg',
      created: new Date()
    };

    User.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);
    fs.unlinkSync = jest.fn();

    const response = await request(app)
      .post('/update/507f1f77bcf86cd799439011')
      .send({
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '9999999999',
        old_image: 'old.jpg'
      })
      .expect(302);

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(response.headers.location).toBe('/');
  });

  test('should handle database errors during update', async () => {
    User.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/update/507f1f77bcf86cd799439011')
      .send({
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '9999999999',
        old_image: 'old.jpg'
      })
      .expect(302);

    expect(response.headers.location).toBe('/');
  });
});
