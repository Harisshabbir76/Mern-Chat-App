import { useEffect } from 'react';
import { Redirect } from 'wouter';

export default function HomePage() {
  // This is just a redirect page to the chat page
  // when a user visits the root URL
  return <Redirect to="/" />;
}
