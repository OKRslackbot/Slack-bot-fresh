function validateObjectiveInput(args) {
  const errors = [];
  
  // Title validation
  if (!args.title || args.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (args.title.length > 200) {
    errors.push('Title must be 200 characters or less');
  }
  
  // Description validation
  if (args.description && args.description.length > 1000) {
    errors.push('Description must be 1000 characters or less');
  }
  
  // Owner validation
  if (args.owner && !isValidSlackUsername(args.owner)) {
    errors.push('Invalid owner username format');
  }
  
  // Due date validation
  if (args.dueDate && !isValidDate(args.dueDate)) {
    errors.push('Invalid due date format. Use YYYY-MM-DD');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join(', ')
  };
}

function validateKeyResultInput(args) {
  const errors = [];
  
  // Title validation
  if (!args.title || args.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (args.title.length > 200) {
    errors.push('Title must be 200 characters or less');
  }
  
  // Description validation
  if (args.description && args.description.length > 1000) {
    errors.push('Description must be 1000 characters or less');
  }
  
  // Target validation
  if (!args.target) {
    errors.push('Target value is required');
  } else if (isNaN(parseFloat(args.target))) {
    errors.push('Target must be a valid number');
  } else if (parseFloat(args.target) <= 0) {
    errors.push('Target must be greater than 0');
  }
  
  // Unit validation
  if (args.unit && !isValidUnit(args.unit)) {
    errors.push('Invalid unit. Common units: percent, dollars, customers, points, hours');
  }
  
  // Owner validation
  if (args.owner && !isValidSlackUsername(args.owner)) {
    errors.push('Invalid owner username format');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join(', ')
  };
}

function validateProgressUpdate(current, target, unit) {
  const errors = [];
  
  if (isNaN(parseFloat(current))) {
    errors.push('Current value must be a valid number');
  } else if (parseFloat(current) < 0) {
    errors.push('Current value cannot be negative');
  }
  
  if (isNaN(parseFloat(target))) {
    errors.push('Target value must be a valid number');
  } else if (parseFloat(target) <= 0) {
    errors.push('Target must be greater than 0');
  }
  
  if (unit && !isValidUnit(unit)) {
    errors.push('Invalid unit format');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join(', ')
  };
}

function validateStatus(status, type = 'objective') {
  const validObjectiveStatuses = ['active', 'completed', 'cancelled', 'draft'];
  const validKeyResultStatuses = ['active', 'completed', 'cancelled', 'blocked'];
  
  const validStatuses = type === 'objective' ? validObjectiveStatuses : validKeyResultStatuses;
  
  if (!validStatuses.includes(status)) {
    return {
      valid: false,
      error: `Invalid status. Valid options: ${validStatuses.join(', ')}`
    };
  }
  
  return { valid: true };
}

function validatePriority(priority) {
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  
  if (!validPriorities.includes(priority)) {
    return {
      valid: false,
      error: `Invalid priority. Valid options: ${validPriorities.join(', ')}`
    };
  }
  
  return { valid: true };
}

function validateId(id) {
  if (!id || typeof id !== 'string') {
    return {
      valid: false,
      error: 'ID is required and must be a string'
    };
  }
  
  if (id.trim().length === 0) {
    return {
      valid: false,
      error: 'ID cannot be empty'
    };
  }
  
  return { valid: true };
}

function validateDateRange(startDate, endDate) {
  const errors = [];
  
  if (startDate && !isValidDate(startDate)) {
    errors.push('Invalid start date format');
  }
  
  if (endDate && !isValidDate(endDate)) {
    errors.push('Invalid end date format');
  }
  
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push('Start date cannot be after end date');
  }
  
  return {
    valid: errors.length === 0,
    error: errors.join(', ')
  };
}

function validateAssigneeList(assignees) {
  if (!Array.isArray(assignees)) {
    return {
      valid: false,
      error: 'Assignees must be an array'
    };
  }
  
  const invalidUsers = assignees.filter(user => !isValidSlackUsername(user));
  
  if (invalidUsers.length > 0) {
    return {
      valid: false,
      error: `Invalid usernames: ${invalidUsers.join(', ')}`
    };
  }
  
  return { valid: true };
}

// Helper Functions

function isValidSlackUsername(username) {
  if (!username || typeof username !== 'string') return false;
  
  // Remove @ if present
  const cleanUsername = username.replace('@', '');
  
  // Slack username rules: 3-21 chars, alphanumeric, dots, dashes, underscores
  const usernameRegex = /^[a-zA-Z0-9._-]{3,21}$/;
  return usernameRegex.test(cleanUsername);
}

function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  
  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
}

function isValidUnit(unit) {
  if (!unit || typeof unit !== 'string') return false;
  
  const commonUnits = [
    'percent', '%', 'percentage',
    'dollars', '$', 'usd', 'euro', 'pounds',
    'customers', 'users', 'people', 'subscribers',
    'points', 'score', 'rating',
    'hours', 'days', 'weeks', 'months',
    'items', 'products', 'features',
    'clicks', 'views', 'visits',
    'sales', 'revenue', 'profit',
    'number', 'count', 'quantity'
  ];
  
  return commonUnits.includes(unit.toLowerCase()) || unit.length <= 20;
}

function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUrlFormat(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove potentially harmful characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

function validateNumericRange(value, min = 0, max = Infinity) {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: 'Value must be a valid number'
    };
  }
  
  if (num < min || num > max) {
    return {
      valid: false,
      error: `Value must be between ${min} and ${max}`
    };
  }
  
  return { valid: true };
}

module.exports = {
  validateObjectiveInput,
  validateKeyResultInput,
  validateProgressUpdate,
  validateStatus,
  validatePriority,
  validateId,
  validateDateRange,
  validateAssigneeList,
  isValidSlackUsername,
  isValidDate,
  isValidUnit,
  validateEmailFormat,
  validateUrlFormat,
  sanitizeInput,
  validateNumericRange
};