import { redirect } from 'next/navigation';

/** Root page — redirects to login */
export default function RootPage() {
  redirect('/login');
}
