import * as React from 'react'
import Link from 'next/link'
import EnvCard from './cards/envcard'

export async function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center w-full h-16 px-4 border-b shrink-0 bg-white justify-between">  
      <div className="flex items-center">
        <Link href="/" rel="nofollow" className="mr-2 font-bold text-lg flex items-center gap-2">
           🌲 Forest Watch
        </Link>
      </div>
      <EnvCard />
    </header>
  )
}