import { Button } from "@/components/ui/button";
import { Plus, Cloud } from "lucide-react";
import AlbumFormDialog from "./AlbumDialog";
import { toast } from "sonner";

export default function AlbumHeader({
  onAlbumChange,
}: {
  onAlbumChange: () => void;
}) {
  const handleCloudSync = async () => {
    try {
      await window.electronAPI.getAlbums(true);
      toast.success("Albums synced from cloud successfully");
      onAlbumChange(); 
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync albums from cloud");
    }
  };

  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Albums</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage and organize your photography collections
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative group">
          <Button
            onClick={handleCloudSync}
            className="bg-gray-200 text-black hover:bg-gray-300 rounded-[6px] h-10 w-10 p-0"
            title="Sync albums from cloud"
          >
            <Cloud className="h-5 w-5" />
          </Button>
          <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 -top-7 left-0 w-max transform -translate-x-1/2">
            Sync albums from cloud
          </span>
        </div>
        <AlbumFormDialog
          trigger={
            <Button className="flex items-center gap-2 cursor-pointer bg-black text-white hover:bg-black/80 rounded-[6px]">
              <Plus className="mr-2 h-4 w-4" /> Create Album
            </Button>
          }
          onAlbumChange={onAlbumChange}
        />
      </div>
    </div>
  );
}