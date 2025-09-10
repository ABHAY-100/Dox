import React from 'react'
import RepoCard from './repoCard'

const DashboardLayout = () => {
  return (
    <div className='flex flex-col gap-6 p-6 md:p-10'>
      <h2 className='text-3xl font-black'>Your Repositories</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RepoCard name="Repo 1" description="Description for Repo 1" isPrivate/>
        <RepoCard name="Repo 2" description="Description for Repo 2" />
        <RepoCard name="Repo 3" description="Description for Repo 3" />
      </div>
    </div>
  )
}

export default DashboardLayout