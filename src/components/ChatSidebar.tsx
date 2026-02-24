import { useState } from 'react';
import {
  Plus, Search, FolderOpen, MessageSquare, Trash2, MoreHorizontal,
  ChevronRight, ChevronDown, Edit2, FolderPlus, X,
} from 'lucide-react';
import { ChatProject, ChatConversation } from '@/hooks/useConversations';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChatSidebarProps {
  projects: ChatProject[];
  conversations: ChatConversation[];
  activeConversationId: string | null;
  searchQuery: string;
  searchResults: { conversationId: string; messageId: string; content: string; role: string }[];
  onSelectConversation: (id: string) => void;
  onNewConversation: (projectId?: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onMoveConversation: (convId: string, projectId: string | null) => void;
  onSearch: (query: string) => void;
  onSearchResultClick: (conversationId: string) => void;
  onClose?: () => void;
}

const ChatSidebar = ({
  projects, conversations, activeConversationId,
  searchQuery, searchResults,
  onSelectConversation, onNewConversation, onDeleteConversation,
  onRenameConversation, onCreateProject, onDeleteProject, onMoveConversation,
  onSearch, onSearchResultClick, onClose,
}: ChatSidebarProps) => {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
    setContextMenuId(null);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const ungrouped = conversations.filter(c => !c.project_id);
  const isSearching = searchQuery.trim().length > 0;

  // Filter conversations by search
  const filteredUngrouped = isSearching && !searchResults.length
    ? ungrouped.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : ungrouped;

  return (
    <div className="flex flex-col h-full bg-secondary/30 border-r border-border/50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Chats</span>
          <div className="flex items-center gap-1">
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowNewProject(true)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="New project"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Prominent New Chat button */}
        <button
          onClick={() => onNewConversation()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search chats & messages…"
            className="w-full pl-7 pr-7 py-1.5 text-sm bg-background border border-border/50 rounded-md outline-none focus:border-primary/40 placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* New project input */}
        {showNewProject && (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="Project name…"
              className="flex-1 px-2 py-1 text-sm bg-background border border-border/50 rounded-md outline-none focus:border-primary/40"
            />
            <button onClick={handleCreateProject} className="p-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={() => setShowNewProject(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1.5">
          {/* Search results */}
          {isSearching && searchResults.length > 0 && (
            <div className="px-2 mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Messages ({searchResults.length})
              </span>
              {searchResults.map(r => {
                const conv = conversations.find(c => c.id === r.conversationId);
                return (
                  <button
                    key={r.messageId}
                    onClick={() => onSearchResultClick(r.conversationId)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors mt-0.5"
                  >
                    <span className="text-[10px] text-primary font-medium block truncate">{conv?.title || 'Chat'}</span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {r.role === 'user' ? 'You: ' : 'AI: '}{r.content.slice(0, 60)}…
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Projects */}
          {projects.map(project => {
            const projectConvs = conversations.filter(c => c.project_id === project.id);
            const isExpanded = expandedProjects.has(project.id);

            if (isSearching && !projectConvs.some(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))) {
              return null;
            }

            return (
              <div key={project.id} className="px-1.5 mb-0.5">
                <div className="flex items-center gap-1 group">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 px-1.5 py-1.5 rounded-md hover:bg-secondary/50 transition-colors text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    }
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="text-[11px] font-medium text-foreground truncate">{project.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{projectConvs.length}</span>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onNewConversation(project.id)} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteProject(project.id)} className="p-0.5 rounded text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-4 space-y-0.5 mt-0.5">
                    {projectConvs.length === 0 && (
                      <p className="text-[10px] text-muted-foreground px-2 py-1 italic">No chats yet</p>
                    )}
                    {projectConvs.map(conv => (
                      <ConversationRow
                        key={conv.id}
                        conv={conv}
                        isActive={conv.id === activeConversationId}
                        editingId={editingId}
                        editTitle={editTitle}
                        contextMenuId={contextMenuId}
                        projects={projects}
                        onSelect={() => onSelectConversation(conv.id)}
                        onStartRename={() => startRename(conv.id, conv.title)}
                        onCommitRename={commitRename}
                        onEditTitleChange={setEditTitle}
                        onDelete={() => onDeleteConversation(conv.id)}
                        onContextMenu={() => setContextMenuId(contextMenuId === conv.id ? null : conv.id)}
                        onMoveToProject={(projectId) => onMoveConversation(conv.id, projectId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped */}
          {filteredUngrouped.length > 0 && (
            <div className="px-1.5">
              {projects.length > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 block mb-0.5">
                  Ungrouped
                </span>
              )}
              <div className="space-y-0.5">
                {filteredUngrouped.map(conv => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConversationId}
                    editingId={editingId}
                    editTitle={editTitle}
                    contextMenuId={contextMenuId}
                    projects={projects}
                    onSelect={() => onSelectConversation(conv.id)}
                    onStartRename={() => startRename(conv.id, conv.title)}
                    onCommitRename={commitRename}
                    onEditTitleChange={setEditTitle}
                    onDelete={() => onDeleteConversation(conv.id)}
                    onContextMenu={() => setContextMenuId(contextMenuId === conv.id ? null : conv.id)}
                    onMoveToProject={(projectId) => onMoveConversation(conv.id, projectId)}
                  />
                ))}
              </div>
            </div>
          )}

          {conversations.length === 0 && !isSearching && (
            <div className="px-4 py-6 text-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">No conversations yet</p>
              <button
                onClick={() => onNewConversation()}
                className="mt-2 text-[11px] text-primary hover:underline"
              >
                Start a new chat
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const ConversationRow = ({
  conv, isActive, editingId, editTitle, contextMenuId, projects,
  onSelect, onStartRename, onCommitRename, onEditTitleChange,
  onDelete, onContextMenu, onMoveToProject,
}: {
  conv: ChatConversation;
  isActive: boolean;
  editingId: string | null;
  editTitle: string;
  contextMenuId: string | null;
  projects: ChatProject[];
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onEditTitleChange: (v: string) => void;
  onDelete: () => void;
  onContextMenu: () => void;
  onMoveToProject: (projectId: string | null) => void;
}) => {
  const isEditing = editingId === conv.id;
  const showMenu = contextMenuId === conv.id;

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors ${
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-foreground'
        }`}
      >
        <MessageSquare className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => onEditTitleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCommitRename(); }}
              onBlur={onCommitRename}
              onClick={e => e.stopPropagation()}
              className="w-full text-[11px] bg-background border border-primary/40 rounded px-1 py-0.5 outline-none"
            />
          ) : (
            <>
              <span className="text-[11px] font-medium block truncate">{conv.title}</span>
              {conv.last_message_preview && (
                <span className="text-[10px] text-muted-foreground block truncate">{conv.last_message_preview}</span>
              )}
            </>
          )}
        </div>
        {conv.message_count ? (
          <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">{conv.message_count}</span>
        ) : null}
      </button>

      {/* Context actions */}
      <button
        onClick={e => { e.stopPropagation(); onContextMenu(); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground transition-all"
      >
        <MoreHorizontal className="w-3 h-3" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full z-10 bg-card border border-border rounded-md shadow-lg py-0.5 min-w-[140px]">
          <button onClick={onStartRename} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/50 flex items-center gap-2">
            <Edit2 className="w-3 h-3" /> Rename
          </button>
          {projects.length > 0 && (
            <>
              <div className="border-t border-border/50 my-0.5" />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground px-3 py-1 block">Move to</span>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => onMoveToProject(p.id)}
                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/50 flex items-center gap-2 ${conv.project_id === p.id ? 'text-primary' : ''}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.name}
                  {conv.project_id === p.id && <span className="text-[9px] ml-auto">✓</span>}
                </button>
              ))}
              {conv.project_id && (
                <button
                  onClick={() => onMoveToProject(null)}
                  className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/50 flex items-center gap-2 text-muted-foreground"
                >
                  <X className="w-3 h-3" /> Ungroup
                </button>
              )}
            </>
          )}
          <div className="border-t border-border/50 my-0.5" />
          <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-destructive/10 text-destructive flex items-center gap-2">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
