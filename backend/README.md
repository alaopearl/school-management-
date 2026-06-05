# Student Record Tracker - Backend API

A RESTful API backend for the Student Record Tracker application. Built with Node.js, Express, and SQLite.

## Features

- Complete CRUD operations for student records
- Advanced filtering and search capabilities
- Comprehensive analytics and reporting
- SQLite database for data persistence
- RESTful API architecture
- CORS enabled for frontend integration
- Input validation and error handling

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

## Configuration

Create or modify the `.env` file in the backend directory:

```env
PORT=5000
NODE_ENV=development
DATABASE_PATH=./students.db
```

## Running the Server

### Development Mode (with hot reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Student Management

#### Get All Students
```
GET /api/students
```

Response:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "STU001",
      "name": "John Doe",
      "dateOfBirth": "2015-03-15",
      "gender": "Male",
      "currentLevel": "Primary 3",
      "enrollmentDate": "2020-09-01",
      "parentName": "Jane Doe",
      "contactNumber": "08123456789",
      "address": "123 Main St",
      "gpa": 4.5,
      "status": "Active",
      "notes": "Excellent student",
      "recordDate": "2024-05-26T10:30:00",
      "lastUpdated": "2024-05-26T10:30:00"
    }
  ]
}
```

#### Get Student by ID
```
GET /api/students/:id
```

#### Create New Student
```
POST /api/students
Content-Type: application/json

{
  "id": "STU001",
  "name": "John Doe",
  "dateOfBirth": "2015-03-15",
  "gender": "Male",
  "currentLevel": "Primary 3",
  "enrollmentDate": "2020-09-01",
  "parentName": "Jane Doe",
  "contactNumber": "08123456789",
  "address": "123 Main St",
  "gpa": 4.5,
  "status": "Active",
  "notes": "Excellent student"
}
```

Required fields: `id`, `name`, `dateOfBirth`, `gender`, `currentLevel`, `enrollmentDate`, `parentName`, `contactNumber`

#### Update Student
```
PUT /api/students/:id
Content-Type: application/json

{
  "name": "John Updated",
  "currentLevel": "Primary 4",
  "gpa": 4.7,
  "status": "Active"
}
```

#### Delete Student
```
DELETE /api/students/:id
```

#### Search Students
```
GET /api/students/search/query?q=john
```

Search by: name, ID, parent name, or contact number

#### Filter Students
```
POST /api/students/filter
Content-Type: application/json

{
  "level": "Primary 3",
  "status": "Active",
  "gender": "Male"
}
```

### Reports & Analytics

#### Get Statistics
```
GET /api/reports/statistics
```

Response:
```json
{
  "success": true,
  "data": {
    "totalStudents": 25,
    "activeStudents": 23,
    "graduatedStudents": 2,
    "averageGPA": "4.12"
  }
}
```

#### Get Level Distribution
```
GET /api/reports/level-distribution
```

#### Get Gender Distribution
```
GET /api/reports/gender-distribution
```

#### Get Status Distribution
```
GET /api/reports/status-distribution
```

#### Get Average GPA by Level
```
GET /api/reports/gpa-by-level
```

#### Get Comprehensive Dashboard Data
```
GET /api/reports/dashboard
```

Returns all statistics, distributions, and analytics in one request.

#### Health Check
```
GET /api/health
```

## Database Schema

### Students Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key - Student ID |
| name | TEXT | Student full name |
| dateOfBirth | TEXT | Birth date (YYYY-MM-DD) |
| gender | TEXT | Gender (Male/Female/Other) |
| currentLevel | TEXT | Current educational level |
| enrollmentDate | TEXT | Enrollment date (YYYY-MM-DD) |
| parentName | TEXT | Parent/Guardian name |
| contactNumber | TEXT | Contact phone number |
| address | TEXT | Residential address |
| gpa | REAL | Current GPA/Grade (0-5) |
| status | TEXT | Student status (Active/On Leave/Transferred/Graduated) |
| notes | TEXT | Additional notes |
| recordDate | DATETIME | Record creation timestamp |
| lastUpdated | DATETIME | Last update timestamp |

## Educational Levels

The system supports these educational levels:
- Creche
- Nursery
- Primary 1-6
- Junior Secondary 1-3
- Senior Secondary 1-3

## Student Status Options

- Active
- On Leave
- Transferred
- Graduated

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Successful request
- `201`: Resource created successfully
- `400`: Bad request / Validation error
- `404`: Resource not found
- `409`: Conflict (e.g., duplicate ID)
- `500`: Internal server error

Error responses include a descriptive error message:
```json
{
  "error": "Error description"
}
```

## Project Structure

```
backend/
├── server.js           # Main Express application
├── database.js         # SQLite database operations
├── package.json        # Project dependencies
├── .env               # Environment variables
├── .gitignore         # Git ignore file
├── routes/
│   ├── students.js    # Student CRUD routes
│   └── reports.js     # Analytics routes
└── students.db        # SQLite database file (created on first run)
```

## Connecting Frontend to Backend

Update the frontend `script.js` to use the backend API:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';

// Example: Create student
async function createStudent(studentData) {
    const response = await fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
    });
    return response.json();
}
```

## Example Usage

### Create a student
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "id": "STU001",
    "name": "John Doe",
    "dateOfBirth": "2015-03-15",
    "gender": "Male",
    "currentLevel": "Primary 3",
    "enrollmentDate": "2020-09-01",
    "parentName": "Jane Doe",
    "contactNumber": "08123456789",
    "address": "123 Main St",
    "gpa": 4.5,
    "status": "Active"
  }'
```

### Get all students
```bash
curl http://localhost:5000/api/students
```

### Search for a student
```bash
curl "http://localhost:5000/api/students/search/query?q=john"
```

### Get dashboard statistics
```bash
curl http://localhost:5000/api/reports/dashboard
```

## Performance Considerations

- The database uses SQLite, suitable for small to medium deployments
- For large-scale production, consider migrating to PostgreSQL or MongoDB
- Implement pagination for large result sets
- Add database indexing on frequently searched fields (name, id, status)

## Security Notes

For production deployment:
- Add authentication/authorization middleware
- Implement rate limiting
- Add input sanitization
- Use HTTPS
- Add request logging and monitoring
- Implement data backup strategy

## Troubleshooting

### Port already in use
Change the PORT in `.env` file to an available port

### Database locked error
Ensure only one instance of the server is running

### CORS errors
Verify CORS is properly configured for your frontend URL

## License

MIT

## Support

For issues or questions, please refer to the main project documentation.
