import Navbar from "./components/Navbar";
import Sidenav from "./components/Sidenav";
import TabBar from "../components/TabBar";
import { useState } from "react";

export default function ConfigLayout(){
        const [sidebarOpen, setSidebarOpen] = useState(false);
    
    return (
        <div className="h-screen flex flex-col overflow-hidden max-w-full">
            <Navbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
            <div className="flex flex-1 overflow-hidden min-w-0">
                <Sidenav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 min-w-0 bg-background text-text-primary overflow-y-auto overflow-x-clip p-4 sm:p-6">
                    <TabBar/>
                </main>
            </div>
        </div>
    );
}
