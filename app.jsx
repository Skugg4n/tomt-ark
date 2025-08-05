        // Import necessary components from a global object provided by the CDN scripts
        const { useState, useRef, useEffect, useMemo } = React;
        const { Circle, CheckCircle, Calendar, Archive, Trash2, ArchiveRestore, ChevronDown, FileText, MessageSquare, Star, Plus, View, Link: LinkIcon, X, LogOut, AlertTriangle } = lucide;

        // --- Firebase SDKs ---
        // These are ESM modules, so we need to import them from the global Firebase object
        const { initializeApp } = firebase.app;
        const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } = firebase.auth;
        const { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp } = firebase.firestore;

        // User's Firebase Configuration
        const firebaseConfig = {
          apiKey: "AIzaSyC664w9yU35jfV8f3PbfQx7rzlLPR9BA_A",
          authDomain: "tomt-ark.firebaseapp.com",
          projectId: "tomt-ark",
          storageBucket: "tomt-ark.appspot.com",
          messagingSenderId: "96430976517",
          appId: "1:96430976517:web:64b13d2db611269206b66c",
          measurementId: "G-35L8WY0PE5"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- Helper functions ---
        const generateId = () => doc(collection(db, 'temp')).id;
        const toISODateString = (date) => date.toISOString().split('T')[0];
        const getToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
        const getTomorrow = () => { const d = getToday(); d.setDate(d.getDate() + 1); return d; };
        const getEndOfWeek = () => { const d = getToday(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 7); return new Date(d.setDate(diff)); };
        const parseDate = (dateString) => { if (!dateString) return null; const d = new Date(dateString); return new Date(d.valueOf() + d.getTimezoneOffset() * 60 * 1000); };
        const formatDate = (dateString) => {
            if (!dateString) return null;
            const date = parseDate(dateString);
            const today = getToday();
            const tomorrow = getTomorrow();
            if (date.getTime() === today.getTime()) return 'Idag';
            if (date.getTime() === tomorrow.getTime()) return 'I morgon';
            return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
        };
        const parseContent = (content) => {
            let priority = 0;
            let text = content;
            const priorityMatch = content.match(/^!([1-5])\s/);
            if (priorityMatch) {
                priority = parseInt(priorityMatch[1], 10);
                text = content.substring(priorityMatch[0].length);
            }
            if (text.startsWith('# ')) {
                return { isHeader: true, priority: 0, segments: [{ type: 'plain', text: text.substring(2) }] };
            }
            const segments = [];
            const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*)/g;
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    segments.push({ type: 'plain', text: text.substring(lastIndex, match.index) });
                }
                const matchedText = match[0];
                if (matchedText.startsWith('**')) {
                    segments.push({ type: 'bold', text: matchedText.slice(2, -2) });
                } else if (matchedText.startsWith('*')) {
                    segments.push({ type: 'italic', text: matchedText.slice(1, -1) });
                } else {
                    segments.push({ type: 'url', text: matchedText });
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) {
                segments.push({ type: 'plain', text: text.substring(lastIndex) });
            }
            return { isHeader: false, priority, segments: segments.length > 0 ? segments : [{ type: 'plain', text }] };
        };

        // --- Components ---
        const ParsedContent = ({ segments, isCompleted, isHeader }) => {
            let headerClasses = isHeader ? ' text-xl font-bold text-gray-900' : '';
            let statusClasses = isCompleted ? 'line-through text-gray-400' : 'text-gray-800';
            return (
                <span className={`${headerClasses} ${statusClasses}`}>
                    {segments.map((segment, index) => {
                        switch (segment.type) {
                            case 'bold': return <strong key={index}>{segment.text}</strong>;
                            case 'italic': return <em key={index}>{segment.text}</em>;
                            case 'url':
                                const href = segment.text.startsWith('www.') ? `https://${segment.text}` : segment.text;
                                let displayUrl = segment.text;
                                try {
                                   const url = new URL(href);
                                   displayUrl = url.hostname.replace('www.', '');
                                } catch (e) { /* Ignore invalid URLs */ }
                                return (
                                    <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                                        <LinkIcon size={12} className="mr-1 opacity-80"/> {displayUrl}
                                    </a>
                                );
                            default: return <span key={index}>{segment.text}</span>;
                        }
                    })}
                </span>
            );
        };

        const PriorityPicker = ({ onSelect, onClose }) => {
            const pickerRef = useRef(null);
            const priorityBgColors = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-blue-500', 5: 'bg-gray-400' };
            useEffect(() => {
                const handleClickOutside = (event) => {
                    if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                        onClose();
                    }
                };
                document.addEventListener("mousedown", handleClickOutside);
                return () => document.removeEventListener("mousedown", handleClickOutside);
            }, [onClose]);
            return (
                <div ref={pickerRef} className="absolute z-10 top-0 left-4 bg-white shadow-lg rounded-full flex items-center p-1 border border-slate-200">
                    {[1, 2, 3, 4, 5].map(prio => (
                        <button key={prio} onClick={() => onSelect(prio)} className={`h-4 w-4 rounded-full mx-1 ${priorityBgColors[prio]} hover:scale-125 transition-transform`}></button>
                    ))}
                    <button onClick={() => onSelect(0)} className="text-slate-400 hover:text-slate-700 mx-1"><X size={14}/></button>
                </div>
            );
        };

        const ItemComponent = React.memo(({ item, isEditing, isEditingDeadline, isNoteExpanded, isPriorityPickerOpen, onToggleComplete, onSetActive, onSetEditingDeadline, onContentChange, onDeadlineChange, onKeyDown, onArchive, onDelete, onToggleNote, onNoteChange, onToggleHighlight, onTogglePriorityPicker, onSetPriority, }) => {
            const inputRef = useRef(null);
            const noteAreaRef = useRef(null);
            const parsed = parseContent(item.content);
            const isEmptyAndNotEditing = !item.content && !isEditing;
            const isHeader = parsed.isHeader;
            useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);
            useEffect(() => { if (isNoteExpanded && noteAreaRef.current) { noteAreaRef.current.style.height = 'auto'; noteAreaRef.current.style.height = `${noteAreaRef.current.scrollHeight}px`; } }, [item.notes, isNoteExpanded]);
            let baseClasses = `w-full flex-grow bg-transparent focus:outline-none text-base`;
            let statusClasses = item.completed ? 'line-through text-gray-400' : 'text-gray-800';
            let headerClasses = isHeader ? ' text-xl font-bold text-gray-900' : '';
            let highlightClass = item.isHighlighted ? 'underline decoration-yellow-400 decoration-2' : '';
            let combinedClasses = `${baseClasses} ${statusClasses} ${headerClasses} ${highlightClass}`;
            const priorityBgColors = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-blue-500', 5: 'bg-gray-400' };
            const priorityBgClass = parsed.priority > 0 ? priorityBgColors[parsed.priority] : '';
            return (
                <div className="flex flex-col">
                    <div className="flex items-center group py-1 rounded-md transition-all duration-150 relative">
                        <div className="flex-shrink-0 relative" style={{width: '20px'}}>
                            <button onClick={() => onTogglePriorityPicker(item.id)} className="w-full h-full flex items-center justify-center">
                                {priorityBgClass && <div className={`h-2 w-2 rounded-full ${priorityBgClass}`}></div>}
                            </button>
                            {isPriorityPickerOpen && <PriorityPicker onSelect={(prio) => onSetPriority(item.id, prio)} onClose={() => onTogglePriorityPicker(null)} />}
                        </div>
                        <div className="flex-shrink-0" style={{width: '20px'}}>
                            {(!isEmptyAndNotEditing && !isHeader) && (<button onClick={() => onToggleComplete(item.id)} className="text-gray-400 hover:text-gray-600 transition-colors">{item.completed ? <CheckCircle size={18} className="text-blue-500" /> : <Circle size={18} />}</button>)}
                        </div>
                        <div className="flex-grow ml-2" onClick={() => onSetActive(item.id)}>
                            {isEditing ? (
                                <input ref={inputRef} type="text" value={item.content} onChange={(e) => onContentChange(item.id, e.target.value)} onKeyDown={(e) => onKeyDown(e, item.id)} onBlur={() => onSetActive(null)} className={combinedClasses} style={{ paddingLeft: `${item.indent * 28}px` }} />
                            ) : (
                                <div className={combinedClasses} style={{ paddingLeft: `${item.indent * 28}px`, paddingTop: '1px', paddingBottom: '1px' }}>{item.content ? <ParsedContent segments={parsed.segments} isCompleted={item.completed} isHeader={isHeader} /> : <div className="h-6">&nbsp;</div>}</div>
                            )}
                        </div>
                        {(!isEmptyAndNotEditing && !isHeader) && (
                            <div className="flex items-center flex-shrink-0 ml-4 w-52 text-right">
                                <div className="w-28">
                                    {isEditingDeadline ? (
                                         <input type="date" className="bg-gray-100 border border-gray-300 rounded-md text-sm p-1 w-full" value={item.deadline || ''} onChange={(e) => onDeadlineChange(item.id, e.target.value)} onBlur={() => onSetEditingDeadline(null)} autoFocus />
                                    ) : (
                                        <button onClick={() => onSetEditingDeadline(item.id)} className={`h-6 transition-opacity text-gray-500 hover:text-gray-800 text-sm flex items-center justify-end w-full ${item.deadline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            {item.deadline ? (<><span className="font-medium">{formatDate(item.deadline)}</span><Calendar size={14} className="ml-2" /></>) : (<Calendar size={16} />)}
                                        </button>
                                    )}
                                </div>
                                <div className="w-24 flex justify-end">
                                    <button onClick={() => onToggleNote(item.id)} className={`text-gray-400 hover:text-blue-600 p-1 transition-opacity ${item.notes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{item.notes ? <MessageSquare size={16} /> : <FileText size={16} />}</button>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onToggleHighlight(item.id)} className="text-gray-400 hover:text-yellow-500 p-1"><Star size={16} className={item.isHighlighted ? 'fill-current text-yellow-500' : ''} /></button>
                                        <button onClick={() => onArchive(item.id)} className="text-gray-400 hover:text-blue-600 p-1"><Archive size={16} /></button>
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {isNoteExpanded && !isEmptyAndNotEditing && (
                        <div className="pl-12 ml-5 pr-4 pb-2">
                            <textarea ref={noteAreaRef} value={item.notes} onChange={(e) => onNoteChange(item.id, e.target.value)} className="w-full min-h-[60px] p-2 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none overflow-hidden" placeholder="Lägg till anteckningar..." autoFocus />
                        </div>
                    )}
                </div>
            );
        });

        const LoginScreen = ({ onLogin }) => (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-700 mb-4">Tomt Ark</h1>
                    <p className="text-slate-500 mb-8">Logga in för att spara dina idéer och uppgifter i molnet.</p>
                    <button onClick={onLogin} className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                        Logga in med Google
                    </button>
                </div>
            </div>
        );

        const TodoApp = ({ user }) => {
            const [sheets, setSheets] = useState([]);
            const [isLoading, setIsLoading] = useState(true);
            const [activeSheetId, setActiveSheetId] = useState('agenda');
            const activeSheet = sheets.find(s => s.id === activeSheetId);

            const [isArchiveVisible, setIsArchiveVisible] = useState(false);
            const [activeId, setActiveId] = useState(null);
            const [editingDeadlineId, setEditingDeadlineId] = useState(null);
            const [expandedNoteId, setExpandedNoteId] = useState(null);
            const [isEditingTitle, setIsEditingTitle] = useState(false);
            const [editingPriorityId, setEditingPriorityId] = useState(null);

            useEffect(() => {
                if (!user) return;
                setIsLoading(true);
                const sheetsCollectionRef = collection(db, 'users', user.uid, 'sheets');
                const q = query(sheetsCollectionRef, orderBy('createdAt'));

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    if (snapshot.empty) {
                        const defaultSheets = [
                            { title: 'Jobb', items: [{ id: generateId(), content: '# Projekt: Lansera ny Hemsida (Q4)', completed: false, indent: 0, deadline: null, notes: '', isHighlighted: false }], archivedItems: [], createdAt: serverTimestamp() },
                            { title: 'Privat', items: [{ id: generateId(), content: '# Personliga mål', completed: false, indent: 0, deadline: null, notes: '', isHighlighted: false }], archivedItems: [], createdAt: serverTimestamp() }
                        ];
                        defaultSheets.forEach(sheet => addDoc(sheetsCollectionRef, sheet));
                    } else {
                        const sheetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setSheets(sheetsData);
                    }
                    setIsLoading(false);
                });

                return () => unsubscribe();
            }, [user]);

            const agendaItems = useMemo(() => {
                const allItems = sheets.flatMap(sheet =>
                    (sheet.items || [])
                        .filter(item => item.deadline && !parseContent(item.content).isHeader)
                        .map(item => ({ ...item, sheetTitle: sheet.title, sheetId: sheet.id }))
                );

                allItems.sort((a, b) => {
                    const dateA = new Date(a.deadline);
                    const dateB = new Date(b.deadline);
                    if (dateA - dateB !== 0) return dateA - dateB;
                    const priorityA = parseContent(a.content).priority;
                    const priorityB = parseContent(b.content).priority;
                    if (priorityA > 0 && priorityB === 0) return -1;
                    if (priorityB > 0 && priorityA === 0) return 1;
                    return priorityA - priorityB;
                });

                const today = getToday();
                const tomorrow = getTomorrow();
                const endOfWeek = getEndOfWeek();
                const groups = { today: [], tomorrow: [], thisWeek: [], later: [] };

                allItems.forEach(item => {
                    const deadline = parseDate(item.deadline);
                    if (!deadline || isNaN(deadline)) return;
                    if (deadline.getTime() === today.getTime()) groups.today.push(item);
                    else if (deadline.getTime() === tomorrow.getTime()) groups.tomorrow.push(item);
                    else if (deadline > tomorrow && deadline <= endOfWeek) groups.thisWeek.push(item);
                    else if (deadline > endOfWeek) groups.later.push(item);
                });
                return groups;
            }, [sheets]);

            const updateSheet = async (sheetId, updates) => {
                try {
                    const sheetRef = doc(db, 'users', user.uid, 'sheets', sheetId);
                    await setDoc(sheetRef, updates, { merge: true });
                } catch (err) {
                    console.error('Failed to update sheet', err);
                }
            };

            const handleItemUpdate = (itemId, updates, targetSheetId) => {
                const sheetToUpdateId = targetSheetId || activeSheetId;
                const sheet = sheets.find(s => s.id === sheetToUpdateId);
                if (!sheet) return;

                const newItems = (sheet.items || []).map(item => item.id === itemId ? { ...item, ...updates } : item);
                updateSheet(sheetToUpdateId, { items: newItems });
            };

            const handleArchive = (id) => {
                const block = findItemBlock(activeSheet.items, id);
                if (!block) return;
                const blockToArchive = activeSheet.items.slice(block.startIndex, block.endIndex + 1);
                const remainingItems = [...activeSheet.items.slice(0, block.startIndex), ...activeSheet.items.slice(block.endIndex + 1)];
                updateSheet(activeSheetId, { items: remainingItems, archivedItems: [...blockToArchive, ...(activeSheet.archivedItems || [])] });
            };

            const handleDelete = (id) => {
                const block = findItemBlock(activeSheet.items, id);
                if (!block) return;
                const remainingItems = [...activeSheet.items.slice(0, block.startIndex), ...activeSheet.items.slice(block.endIndex + 1)];
                updateSheet(activeSheetId, { items: remainingItems });
            };

            const handlePermanentDelete = (id) => {
                const block = findItemBlock(activeSheet.archivedItems, id);
                if (!block) return;
                const remainingItems = [...(activeSheet.archivedItems || []).slice(0, block.startIndex), ...(activeSheet.archivedItems || []).slice(block.endIndex + 1)];
                updateSheet(activeSheetId, { archivedItems: remainingItems });
            };

            const handleRestore = (id) => {
                const block = findItemBlock(activeSheet.archivedItems, id);
                if (!block) return;
                const blockToRestore = activeSheet.archivedItems.slice(block.startIndex, block.endIndex + 1);
                const remainingArchived = [...(activeSheet.archivedItems || []).slice(0, block.startIndex), ...(activeSheet.archivedItems || []).slice(block.endIndex + 1)];
                updateSheet(activeSheetId, { items: [...activeSheet.items, ...blockToRestore], archivedItems: remainingArchived });
            };

            const handleSetPriority = (itemId, sheetId, priority) => {
                const sheet = sheets.find(s => s.id === sheetId);
                if (!sheet) return;
                const item = sheet.items.find(i => i.id === itemId);
                if (!item) return;

                let newContent = item.content.replace(/^!([1-5])\s/, '');
                if (priority > 0) {
                    newContent = `!${priority} ` + newContent;
                }
                handleItemUpdate(itemId, { content: newContent }, sheetId);
                setEditingPriorityId(null);
            };

            const handleKeyDown = (e, id) => {
                const originalIndex = activeSheet.items.findIndex(item => item.id === id);
                if (originalIndex === -1) return;
                const currentItem = activeSheet.items[originalIndex];

                if (e.key === 'Escape') { e.preventDefault(); setActiveId(null); return; }

                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newItem = { id: generateId(), content: '', completed: false, indent: currentItem.indent, deadline: null, notes: '', isHighlighted: false };
                    const newItems = [...activeSheet.items.slice(0, originalIndex + 1), newItem, ...activeSheet.items.slice(originalIndex + 1)];
                    updateSheet(activeSheetId, { items: newItems });
                    setActiveId(newItem.id);
                    return;
                }

                switch (e.key) {
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            handleItemUpdate(id, { indent: Math.max(0, currentItem.indent - 1) });
                        } else {
                            if (originalIndex > 0 && activeSheet.items[originalIndex - 1].indent >= currentItem.indent) {
                                handleItemUpdate(id, { indent: Math.min(10, currentItem.indent + 1) });
                            }
                        }
                        break;
                    case 'Backspace':
                        if (currentItem.content === '' && activeSheet.items.length > 1) {
                            e.preventDefault();
                            let nextActiveId = null;
                            if (originalIndex > 0) nextActiveId = activeSheet.items[originalIndex - 1].id;
                            const remainingItems = activeSheet.items.filter(item => item.id !== id);
                            updateSheet(activeSheetId, { items: remainingItems });
                            setActiveId(nextActiveId);
                        }
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        if (originalIndex > 0) setActiveId(activeSheet.items[originalIndex - 1].id);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        if (originalIndex < activeSheet.items.length - 1) setActiveId(activeSheet.items[originalIndex + 1].id);
                        break;
                }
            };

            const handleAddSheet = async () => {
                try {
                    const sheetsCollectionRef = collection(db, 'users', user.uid, 'sheets');
                    const newSheet = {
                        title: 'Nytt Ark',
                        items: [{ id: generateId(), content: '', completed: false, indent: 0, deadline: null, notes: '', isHighlighted: false }],
                        archivedItems: [],
                        createdAt: serverTimestamp()
                    };
                    const docRef = await addDoc(sheetsCollectionRef, newSheet);
                    setActiveSheetId(docRef.id);
                } catch (err) {
                    console.error('Failed to add sheet', err);
                }
            };

            const handleNavigate = (sheetId, itemId) => {
                setActiveSheetId(sheetId);
                setTimeout(() => { setActiveId(itemId); setTimeout(() => setActiveId(null), 1000); }, 0);
            };

            const AgendaItem = ({ item }) => {
                const parsed = parseContent(item.content);
                const priorityBgClass = parsed.priority > 0 ? priorityBgColors[parsed.priority] : '';
                return (
                    <div className={`flex items-center py-1.5 ${item.isHighlighted ? 'underline decoration-yellow-400 decoration-2' : ''}`}>
                        <div className="flex-shrink-0 relative" style={{width: '20px'}}>
                            <button onClick={() => setEditingPriorityId(item.id)} className="w-full h-full flex items-center justify-center">
                                {priorityBgClass && <div className={`h-2 w-2 rounded-full ${priorityBgClass}`}></div>}
                            </button>
                            {editingPriorityId === item.id && <PriorityPicker onSelect={(prio) => handleSetPriority(item.id, item.sheetId, prio)} onClose={() => setEditingPriorityId(null)} />}
                        </div>
                        <div className="flex-shrink-0" style={{width: '20px'}}>
                           <button onClick={() => handleItemUpdate(item.id, { completed: !item.completed }, item.sheetId)} className="text-gray-400 hover:text-gray-600 transition-colors">
                              {item.completed ? <CheckCircle size={18} className="text-blue-500" /> : <Circle size={18} />}
                           </button>
                        </div>
                        <button onClick={() => handleNavigate(item.sheetId, item.id)} className={`ml-2 flex-grow text-left ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            <ParsedContent segments={parsed.segments} isCompleted={item.completed} isHeader={false} />
                        </button>
                        <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
                            från {item.sheetTitle}
                        </div>
                    </div>
                )
            };

            const priorityBgColors = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-blue-500', 5: 'bg-gray-400' };

            if (isLoading) {
                return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Laddar dina ark...</div>;
            }

            return (
                <div className="min-h-screen bg-slate-100 font-sans text-gray-800 flex justify-center p-4 sm:p-8">
                    <div className="w-full max-w-3xl mt-8 mb-16">
                         <div className="flex items-center border-b border-slate-200 mb-6">
                            <button onClick={() => setActiveSheetId('agenda')} className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center ${activeSheetId === 'agenda' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}><View size={16} className="mr-2"/> Agenda</button>
                            {sheets.map(sheet => (
                                <button key={sheet.id} onClick={() => setActiveSheetId(sheet.id)} className={`px-4 py-2 text-sm font-semibold transition-colors ${activeSheetId === sheet.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>{sheet.title}</button>
                            ))}
                            <button onClick={handleAddSheet} className="p-2 text-slate-400 hover:text-blue-600 ml-2"><Plus size={18}/></button>
                            <div className="flex-grow"></div>
                            <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-600 ml-auto" title="Logga ut"><LogOut size={18}/></button>
                        </div>

                        {activeSheetId === 'agenda' ? (
                             <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200/80">
                                 <h1 className="text-3xl font-bold mb-6 text-slate-700 tracking-tight">Agenda</h1>
                                 {Object.entries(agendaItems).map(([groupKey, groupItems]) => {
                                     if (groupItems.length === 0) return null;
                                     const groupTitles = { today: 'Idag', tomorrow: 'I morgon', thisWeek: 'Denna vecka', later: 'Senare'};
                                     return (
                                         <div key={groupKey} className="mb-6">
                                             <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">{groupTitles[groupKey]}</h2>
                                             {groupItems.map(item => <AgendaItem key={item.id} item={item} />)}
                                         </div>
                                     )
                                 })}
                                 {Object.values(agendaItems).every(arr => arr.length === 0) && (
                                    <p className="text-gray-500">Inga kommande deadlines. Bra jobbat!</p>
                                 )}
                             </div>
                        ) : (
                            activeSheet && <>
                                {isEditingTitle ? (
                                    <input type="text" value={activeSheet.title} onChange={(e) => updateSheet(activeSheetId, { title: e.target.value })} onBlur={() => setIsEditingTitle(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)} className="text-3xl font-bold mb-6 text-slate-700 tracking-tight bg-transparent w-full focus:outline-none" autoFocus />
                                ) : (
                                    <h1 onClick={() => setIsEditingTitle(true)} className="text-3xl font-bold mb-6 text-slate-700 tracking-tight cursor-pointer">{activeSheet.title}</h1>
                                )}

                                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200/80">
                                    {(activeSheet.items || []).map((item) => (
                                        <ItemComponent
                                            key={item.id}
                                            item={item}
                                            isEditing={activeId === item.id}
                                            isEditingDeadline={editingDeadlineId === item.id}
                                            isNoteExpanded={expandedNoteId === item.id}
                                            isPriorityPickerOpen={editingPriorityId === item.id}
                                            onToggleComplete={(id) => handleItemUpdate(id, { completed: !item.completed })}
                                            onSetActive={setActiveId}
                                            onSetEditingDeadline={setEditingDeadlineId}
                                            onContentChange={(id, content) => handleItemUpdate(id, { content })}
                                            onDeadlineChange={(id, deadline) => { handleItemUpdate(id, { deadline }); setEditingDeadlineId(null); }}
                                            onKeyDown={handleKeyDown}
                                            onArchive={handleArchive}
                                            onDelete={handleDelete}
                                            onToggleNote={(id) => setExpandedNoteId(prev => prev === id ? null : id)}
                                            onNoteChange={(id, notes) => handleItemUpdate(id, { notes })}
                                            onToggleHighlight={(id) => handleItemUpdate(id, { isHighlighted: !item.isHighlighted })}
                                            onTogglePriorityPicker={setEditingPriorityId}
                                            onSetPriority={(id, prio) => handleSetPriority(id, activeSheetId, prio)}
                                        />
                                    ))}
                                    {(activeSheet.archivedItems || []).length > 0 && (
                                        <div className="mt-8 pt-4 border-t border-gray-200">
                                            <button onClick={() => setIsArchiveVisible(!isArchiveVisible)} className="flex items-center text-gray-500 font-semibold hover:text-gray-800">
                                                <ChevronDown size={20} className={`transition-transform transform ${isArchiveVisible ? 'rotate-180' : ''}`} />
                                                <span className="ml-2">Arkiv ({activeSheet.archivedItems.length})</span>
                                            </button>
                                            {isArchiveVisible && (
                                                <div className="mt-4">
                                                    {activeSheet.archivedItems.map(item => (
                                                        <div key={item.id} className="flex items-center group py-1 text-gray-500">
                                                            <span className="flex-grow line-through" style={{ paddingLeft: `${(item.indent + 1) * 28}px` }}>{item.content}</span>
                                                            <div className="flex-shrink-0">
                                                                <button onClick={() => handleRestore(item.id)} className="text-gray-400 hover:text-green-600 p-1"><ArchiveRestore size={16} /></button>
                                                                <button onClick={() => handlePermanentDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        <div className="text-xs text-gray-400 mt-6 text-center px-4">
                            <p><span className="font-bold">Markdown:</span> # Rubrik | **Fet** | *Kursiv* | !1 - !5 Prio &nbsp;&nbsp;·&nbsp;&nbsp; <span className="font-bold">Kortkommandon:</span> Enter, Tab, Pilar, Backspace</p>
                        </div>
                    </div>
                </div>
            );
        };

        // --- Top-level Component to handle Auth State ---
        const App = () => {
            const [user, setUser] = useState(null);
            const [loading, setLoading] = useState(true);

            useEffect(() => {
                const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                    setUser(currentUser);
                    setLoading(false);
                });
                return () => unsubscribe();
            }, []);

            const handleLogin = async () => {
                const provider = new GoogleAuthProvider();
                try {
                    await signInWithPopup(auth, provider);
                } catch (error) {
                    console.error("Error signing in with Google", error);
                }
            };

            if (loading) {
                return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Autentiserar...</div>;
            }

            return user ? <TodoApp user={user} /> : <LoginScreen onLogin={handleLogin} />;
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);

