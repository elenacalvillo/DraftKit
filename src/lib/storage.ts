// Storage utilities using localStorage (window.storage API equivalent)

export interface Creator {
  id: string;
  username: string;
  name: string;
  email: string;
  substackUrl: string;
  bio: string;
  welcomeMessage: string;
  createdAt: string;
}

export interface Availability {
  username: string;
  availableDates: string[];
  blockedDates: string[];
  recurringDays: number[]; // 0-6 for Sunday-Saturday
}

export interface CollabRequest {
  id: string;
  creatorUsername: string;
  requesterName: string;
  requesterEmail: string;
  requesterSubstackUrl: string;
  message: string;
  requestedDate: string | null;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

const STORAGE_KEYS = {
  creators: 'collabflow:creators',
  availability: 'collabflow:availability',
  requests: 'collabflow:requests',
  currentUser: 'collabflow:currentUser',
};

// Creator functions
export function getCreator(username: string): Creator | null {
  const creators = getAllCreators();
  return creators.find(c => c.username === username) || null;
}

export function getAllCreators(): Creator[] {
  const data = localStorage.getItem(STORAGE_KEYS.creators);
  return data ? JSON.parse(data) : [];
}

export function saveCreator(creator: Creator): void {
  const creators = getAllCreators();
  const index = creators.findIndex(c => c.id === creator.id);
  if (index >= 0) {
    creators[index] = creator;
  } else {
    creators.push(creator);
  }
  localStorage.setItem(STORAGE_KEYS.creators, JSON.stringify(creators));
}

export function isUsernameTaken(username: string): boolean {
  return getAllCreators().some(c => c.username === username);
}

// Availability functions
export function getAvailability(username: string): Availability | null {
  const data = localStorage.getItem(`${STORAGE_KEYS.availability}:${username}`);
  return data ? JSON.parse(data) : null;
}

export function saveAvailability(availability: Availability): void {
  localStorage.setItem(
    `${STORAGE_KEYS.availability}:${availability.username}`,
    JSON.stringify(availability)
  );
}

// Request functions
export function getRequests(creatorUsername: string): CollabRequest[] {
  const data = localStorage.getItem(`${STORAGE_KEYS.requests}:${creatorUsername}`);
  return data ? JSON.parse(data) : [];
}

export function saveRequest(request: CollabRequest): void {
  const requests = getRequests(request.creatorUsername);
  const index = requests.findIndex(r => r.id === request.id);
  if (index >= 0) {
    requests[index] = request;
  } else {
    requests.push(request);
  }
  localStorage.setItem(
    `${STORAGE_KEYS.requests}:${request.creatorUsername}`,
    JSON.stringify(requests)
  );
}

export function createRequest(
  creatorUsername: string,
  data: Omit<CollabRequest, 'id' | 'creatorUsername' | 'status' | 'createdAt'>
): CollabRequest {
  const request: CollabRequest = {
    ...data,
    id: crypto.randomUUID(),
    creatorUsername,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  saveRequest(request);
  return request;
}

// Auth functions
export function getCurrentUser(): Creator | null {
  const id = localStorage.getItem(STORAGE_KEYS.currentUser);
  if (!id) return null;
  const creators = getAllCreators();
  return creators.find(c => c.id === id) || null;
}

export function setCurrentUser(creator: Creator | null): void {
  if (creator) {
    localStorage.setItem(STORAGE_KEYS.currentUser, creator.id);
  } else {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

// Helper to generate a unique ID
export function generateId(): string {
  return crypto.randomUUID();
}
