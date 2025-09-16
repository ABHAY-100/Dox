import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/axios';
import Navbar from '@/components/common/navbar';
import DashboardLayout from '@/components/common/dashboardLayout';

interface PageProps {
  params: {
    username: string;
  };
}

export default async function UserDashboardPage({ params }: PageProps) {
  try {
    // Verify authentication
    const response = await apiRequest.get('http://localhost:8080/api/v1/profile/get-profile');
    const user = response.data.user;
    
    if (!user) {
      redirect('/');
    }
    
    // Check if the username in URL matches the logged-in user
    const expectedUsername = user.githubUsername || user.name?.toLowerCase();
    if (params.username !== expectedUsername) {
      redirect(`/dashboard/${expectedUsername}`);
    }
    
    return (
      <div>
        <Navbar />
        <DashboardLayout />
      </div>
    );
  } catch (error) {
    redirect('/');
  }
}