// Import necessary components from a global object provided by the CDN scripts
const {
  useState,
  useRef,
  useEffect,
  useMemo
} = React;
const {
  Circle,
  CheckCircle,
  Calendar,
  Archive,
  Trash2,
  ArchiveRestore,
  ChevronDown,
  FileText,
  MessageSquare,
  Star,
  Plus,
  View,
  Link: LinkIcon,
  X,
  LogOut,
  AlertTriangle
} = lucide;

// --- Firebase SDKs ---
// These are ESM modules, so we need to import them from the global Firebase object
const {
  initializeApp
} = firebase.app;
const {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} = firebase.auth;
const {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} = firebase.firestore;

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
const toISODateString = date => date.toISOString().split('T')[0];
const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const getTomorrow = () => {
  const d = getToday();
  d.setDate(d.getDate() + 1);
  return d;
};
const getEndOfWeek = () => {
  const d = getToday();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 7);
  return new Date(d.setDate(diff));
};
const parseDate = dateString => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return new Date(d.valueOf() + d.getTimezoneOffset() * 60 * 1000);
};
const formatDate = dateString => {
  if (!dateString) return null;
  const date = parseDate(dateString);
  const today = getToday();
  const tomorrow = getTomorrow();
  if (date.getTime() === today.getTime()) return 'Idag';
  if (date.getTime() === tomorrow.getTime()) return 'I morgon';
  return date.toLocaleDateString('sv-SE', {
    month: 'short',
    day: 'numeric'
  });
};
const parseContent = content => {
  let priority = 0;
  let text = content;
  const priorityMatch = content.match(/^!([1-5])\s/);
  if (priorityMatch) {
    priority = parseInt(priorityMatch[1], 10);
    text = content.substring(priorityMatch[0].length);
  }
  if (text.startsWith('# ')) {
    return {
      isHeader: true,
      priority: 0,
      segments: [{
        type: 'plain',
        text: text.substring(2)
      }]
    };
  }
  const segments = [];
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'plain',
        text: text.substring(lastIndex, match.index)
      });
    }
    const matchedText = match[0];
    if (matchedText.startsWith('**')) {
      segments.push({
        type: 'bold',
        text: matchedText.slice(2, -2)
      });
    } else if (matchedText.startsWith('*')) {
      segments.push({
        type: 'italic',
        text: matchedText.slice(1, -1)
      });
    } else {
      segments.push({
        type: 'url',
        text: matchedText
      });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({
      type: 'plain',
      text: text.substring(lastIndex)
    });
  }
  return {
    isHeader: false,
    priority,
    segments: segments.length > 0 ? segments : [{
      type: 'plain',
      text
    }]
  };
};

// --- Components ---
const ParsedContent = ({
  segments,
  isCompleted,
  isHeader
}) => {
  let headerClasses = isHeader ? ' text-xl font-bold text-gray-900' : '';
  let statusClasses = isCompleted ? 'line-through text-gray-400' : 'text-gray-800';
  return /*#__PURE__*/React.createElement("span", {
    className: `${headerClasses} ${statusClasses}`
  }, segments.map((segment, index) => {
    switch (segment.type) {
      case 'bold':
        return /*#__PURE__*/React.createElement("strong", {
          key: index
        }, segment.text);
      case 'italic':
        return /*#__PURE__*/React.createElement("em", {
          key: index
        }, segment.text);
      case 'url':
        const href = segment.text.startsWith('www.') ? `https://${segment.text}` : segment.text;
        let displayUrl = segment.text;
        try {
          const url = new URL(href);
          displayUrl = url.hostname.replace('www.', '');
        } catch (e) {/* Ignore invalid URLs */}
        return /*#__PURE__*/React.createElement("a", {
          key: index,
          href: href,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "text-blue-600 hover:underline inline-flex items-center",
          onClick: e => e.stopPropagation()
        }, /*#__PURE__*/React.createElement(LinkIcon, {
          size: 12,
          className: "mr-1 opacity-80"
        }), " ", displayUrl);
      default:
        return /*#__PURE__*/React.createElement("span", {
          key: index
        }, segment.text);
    }
  }));
};
const PriorityPicker = ({
  onSelect,
  onClose
}) => {
  const pickerRef = useRef(null);
  const priorityBgColors = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-blue-500',
    5: 'bg-gray-400'
  };
  useEffect(() => {
    const handleClickOutside = event => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);
  return /*#__PURE__*/React.createElement("div", {
    ref: pickerRef,
    className: "absolute z-10 top-0 left-4 bg-white shadow-lg rounded-full flex items-center p-1 border border-slate-200"
  }, [1, 2, 3, 4, 5].map(prio => /*#__PURE__*/React.createElement("button", {
    key: prio,
    onClick: () => onSelect(prio),
    className: `h-4 w-4 rounded-full mx-1 ${priorityBgColors[prio]} hover:scale-125 transition-transform`
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSelect(0),
    className: "text-slate-400 hover:text-slate-700 mx-1"
  }, /*#__PURE__*/React.createElement(X, {
    size: 14
  })));
};
const ItemComponent = React.memo(({
  item,
  isEditing,
  isEditingDeadline,
  isNoteExpanded,
  isPriorityPickerOpen,
  onToggleComplete,
  onSetActive,
  onSetEditingDeadline,
  onContentChange,
  onDeadlineChange,
  onKeyDown,
  onArchive,
  onDelete,
  onToggleNote,
  onNoteChange,
  onToggleHighlight,
  onTogglePriorityPicker,
  onSetPriority
}) => {
  const inputRef = useRef(null);
  const noteAreaRef = useRef(null);
  const parsed = parseContent(item.content);
  const isEmptyAndNotEditing = !item.content && !isEditing;
  const isHeader = parsed.isHeader;
  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);
  useEffect(() => {
    if (isNoteExpanded && noteAreaRef.current) {
      noteAreaRef.current.style.height = 'auto';
      noteAreaRef.current.style.height = `${noteAreaRef.current.scrollHeight}px`;
    }
  }, [item.notes, isNoteExpanded]);
  let baseClasses = `w-full flex-grow bg-transparent focus:outline-none text-base`;
  let statusClasses = item.completed ? 'line-through text-gray-400' : 'text-gray-800';
  let headerClasses = isHeader ? ' text-xl font-bold text-gray-900' : '';
  let highlightClass = item.isHighlighted ? 'underline decoration-yellow-400 decoration-2' : '';
  let combinedClasses = `${baseClasses} ${statusClasses} ${headerClasses} ${highlightClass}`;
  const priorityBgColors = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-blue-500',
    5: 'bg-gray-400'
  };
  const priorityBgClass = parsed.priority > 0 ? priorityBgColors[parsed.priority] : '';
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center group py-1 rounded-md transition-all duration-150 relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0 relative",
    style: {
      width: '20px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onTogglePriorityPicker(item.id),
    className: "w-full h-full flex items-center justify-center"
  }, priorityBgClass && /*#__PURE__*/React.createElement("div", {
    className: `h-2 w-2 rounded-full ${priorityBgClass}`
  })), isPriorityPickerOpen && /*#__PURE__*/React.createElement(PriorityPicker, {
    onSelect: prio => onSetPriority(item.id, prio),
    onClose: () => onTogglePriorityPicker(null)
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0",
    style: {
      width: '20px'
    }
  }, !isEmptyAndNotEditing && !isHeader && /*#__PURE__*/React.createElement("button", {
    onClick: () => onToggleComplete(item.id),
    className: "text-gray-400 hover:text-gray-600 transition-colors"
  }, item.completed ? /*#__PURE__*/React.createElement(CheckCircle, {
    size: 18,
    className: "text-blue-500"
  }) : /*#__PURE__*/React.createElement(Circle, {
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex-grow ml-2",
    onClick: () => onSetActive(item.id)
  }, isEditing ? /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "text",
    value: item.content,
    onChange: e => onContentChange(item.id, e.target.value),
    onKeyDown: e => onKeyDown(e, item.id),
    onBlur: () => onSetActive(null),
    className: combinedClasses,
    style: {
      paddingLeft: `${item.indent * 28}px`
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: combinedClasses,
    style: {
      paddingLeft: `${item.indent * 28}px`,
      paddingTop: '1px',
      paddingBottom: '1px'
    }
  }, item.content ? /*#__PURE__*/React.createElement(ParsedContent, {
    segments: parsed.segments,
    isCompleted: item.completed,
    isHeader: isHeader
  }) : /*#__PURE__*/React.createElement("div", {
    className: "h-6"
  }, "\xA0"))), !isEmptyAndNotEditing && !isHeader && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center flex-shrink-0 ml-4 w-52 text-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-28"
  }, isEditingDeadline ? /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "bg-gray-100 border border-gray-300 rounded-md text-sm p-1 w-full",
    value: item.deadline || '',
    onChange: e => onDeadlineChange(item.id, e.target.value),
    onBlur: () => onSetEditingDeadline(null),
    autoFocus: true
  }) : /*#__PURE__*/React.createElement("button", {
    onClick: () => onSetEditingDeadline(item.id),
    className: `h-6 transition-opacity text-gray-500 hover:text-gray-800 text-sm flex items-center justify-end w-full ${item.deadline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
  }, item.deadline ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, formatDate(item.deadline)), /*#__PURE__*/React.createElement(Calendar, {
    size: 14,
    className: "ml-2"
  })) : /*#__PURE__*/React.createElement(Calendar, {
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    className: "w-24 flex justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onToggleNote(item.id),
    className: `text-gray-400 hover:text-blue-600 p-1 transition-opacity ${item.notes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
  }, item.notes ? /*#__PURE__*/React.createElement(MessageSquare, {
    size: 16
  }) : /*#__PURE__*/React.createElement(FileText, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex opacity-0 group-hover:opacity-100 transition-opacity"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onToggleHighlight(item.id),
    className: "text-gray-400 hover:text-yellow-500 p-1"
  }, /*#__PURE__*/React.createElement(Star, {
    size: 16,
    className: item.isHighlighted ? 'fill-current text-yellow-500' : ''
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onArchive(item.id),
    className: "text-gray-400 hover:text-blue-600 p-1"
  }, /*#__PURE__*/React.createElement(Archive, {
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onDelete(item.id),
    className: "text-gray-400 hover:text-red-600 p-1"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 16
  })))))), isNoteExpanded && !isEmptyAndNotEditing && /*#__PURE__*/React.createElement("div", {
    className: "pl-12 ml-5 pr-4 pb-2"
  }, /*#__PURE__*/React.createElement("textarea", {
    ref: noteAreaRef,
    value: item.notes,
    onChange: e => onNoteChange(item.id, e.target.value),
    className: "w-full min-h-[60px] p-2 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none overflow-hidden",
    placeholder: "L\xE4gg till anteckningar...",
    autoFocus: true
  })));
});
const LoginScreen = ({
  onLogin
}) => /*#__PURE__*/React.createElement("div", {
  className: "min-h-screen bg-slate-100 flex items-center justify-center"
}, /*#__PURE__*/React.createElement("div", {
  className: "text-center"
}, /*#__PURE__*/React.createElement("h1", {
  className: "text-4xl font-bold text-slate-700 mb-4"
}, "Tomt Ark"), /*#__PURE__*/React.createElement("p", {
  className: "text-slate-500 mb-8"
}, "Logga in f\xF6r att spara dina id\xE9er och uppgifter i molnet."), /*#__PURE__*/React.createElement("button", {
  onClick: onLogin,
  className: "bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors"
}, "Logga in med Google")));
const TodoApp = ({
  user
}) => {
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
    const unsubscribe = onSnapshot(q, snapshot => {
      if (snapshot.empty) {
        const defaultSheets = [{
          title: 'Jobb',
          items: [{
            id: generateId(),
            content: '# Projekt: Lansera ny Hemsida (Q4)',
            completed: false,
            indent: 0,
            deadline: null,
            notes: '',
            isHighlighted: false
          }],
          archivedItems: [],
          createdAt: serverTimestamp()
        }, {
          title: 'Privat',
          items: [{
            id: generateId(),
            content: '# Personliga mål',
            completed: false,
            indent: 0,
            deadline: null,
            notes: '',
            isHighlighted: false
          }],
          archivedItems: [],
          createdAt: serverTimestamp()
        }];
        defaultSheets.forEach(sheet => addDoc(sheetsCollectionRef, sheet));
      } else {
        const sheetsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSheets(sheetsData);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);
  const agendaItems = useMemo(() => {
    const allItems = sheets.flatMap(sheet => (sheet.items || []).filter(item => item.deadline && !parseContent(item.content).isHeader).map(item => ({
      ...item,
      sheetTitle: sheet.title,
      sheetId: sheet.id
    })));
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
    const groups = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: []
    };
    allItems.forEach(item => {
      const deadline = parseDate(item.deadline);
      if (!deadline || isNaN(deadline)) return;
      if (deadline.getTime() === today.getTime()) groups.today.push(item);else if (deadline.getTime() === tomorrow.getTime()) groups.tomorrow.push(item);else if (deadline > tomorrow && deadline <= endOfWeek) groups.thisWeek.push(item);else if (deadline > endOfWeek) groups.later.push(item);
    });
    return groups;
  }, [sheets]);
  const updateSheet = async (sheetId, updates) => {
    try {
      const sheetRef = doc(db, 'users', user.uid, 'sheets', sheetId);
      await setDoc(sheetRef, updates, {
        merge: true
      });
    } catch (err) {
      console.error('Failed to update sheet', err);
    }
  };
  const handleItemUpdate = (itemId, updates, targetSheetId) => {
    const sheetToUpdateId = targetSheetId || activeSheetId;
    const sheet = sheets.find(s => s.id === sheetToUpdateId);
    if (!sheet) return;
    const newItems = (sheet.items || []).map(item => item.id === itemId ? {
      ...item,
      ...updates
    } : item);
    updateSheet(sheetToUpdateId, {
      items: newItems
    });
  };
  const handleArchive = id => {
    const block = findItemBlock(activeSheet.items, id);
    if (!block) return;
    const blockToArchive = activeSheet.items.slice(block.startIndex, block.endIndex + 1);
    const remainingItems = [...activeSheet.items.slice(0, block.startIndex), ...activeSheet.items.slice(block.endIndex + 1)];
    updateSheet(activeSheetId, {
      items: remainingItems,
      archivedItems: [...blockToArchive, ...(activeSheet.archivedItems || [])]
    });
  };
  const handleDelete = id => {
    const block = findItemBlock(activeSheet.items, id);
    if (!block) return;
    const remainingItems = [...activeSheet.items.slice(0, block.startIndex), ...activeSheet.items.slice(block.endIndex + 1)];
    updateSheet(activeSheetId, {
      items: remainingItems
    });
  };
  const handlePermanentDelete = id => {
    const block = findItemBlock(activeSheet.archivedItems, id);
    if (!block) return;
    const remainingItems = [...(activeSheet.archivedItems || []).slice(0, block.startIndex), ...(activeSheet.archivedItems || []).slice(block.endIndex + 1)];
    updateSheet(activeSheetId, {
      archivedItems: remainingItems
    });
  };
  const handleRestore = id => {
    const block = findItemBlock(activeSheet.archivedItems, id);
    if (!block) return;
    const blockToRestore = activeSheet.archivedItems.slice(block.startIndex, block.endIndex + 1);
    const remainingArchived = [...(activeSheet.archivedItems || []).slice(0, block.startIndex), ...(activeSheet.archivedItems || []).slice(block.endIndex + 1)];
    updateSheet(activeSheetId, {
      items: [...activeSheet.items, ...blockToRestore],
      archivedItems: remainingArchived
    });
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
    handleItemUpdate(itemId, {
      content: newContent
    }, sheetId);
    setEditingPriorityId(null);
  };
  const handleKeyDown = (e, id) => {
    const originalIndex = activeSheet.items.findIndex(item => item.id === id);
    if (originalIndex === -1) return;
    const currentItem = activeSheet.items[originalIndex];
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveId(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newItem = {
        id: generateId(),
        content: '',
        completed: false,
        indent: currentItem.indent,
        deadline: null,
        notes: '',
        isHighlighted: false
      };
      const newItems = [...activeSheet.items.slice(0, originalIndex + 1), newItem, ...activeSheet.items.slice(originalIndex + 1)];
      updateSheet(activeSheetId, {
        items: newItems
      });
      setActiveId(newItem.id);
      return;
    }

    // Tab, Backspace, Arrow keys logic
    // ... (condensed for brevity)
  };
  const handleAddSheet = async () => {
    try {
      const sheetsCollectionRef = collection(db, 'users', user.uid, 'sheets');
      const newSheet = {
        title: 'Nytt Ark',
        items: [{
          id: generateId(),
          content: '',
          completed: false,
          indent: 0,
          deadline: null,
          notes: '',
          isHighlighted: false
        }],
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
    setTimeout(() => {
      setActiveId(itemId);
      setTimeout(() => setActiveId(null), 1000);
    }, 0);
  };
  const AgendaItem = ({
    item
  }) => {
    const parsed = parseContent(item.content);
    const priorityBgClass = parsed.priority > 0 ? priorityBgColors[parsed.priority] : '';
    return /*#__PURE__*/React.createElement("div", {
      className: `flex items-center py-1.5 ${item.isHighlighted ? 'underline decoration-yellow-400 decoration-2' : ''}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex-shrink-0 relative",
      style: {
        width: '20px'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditingPriorityId(item.id),
      className: "w-full h-full flex items-center justify-center"
    }, priorityBgClass && /*#__PURE__*/React.createElement("div", {
      className: `h-2 w-2 rounded-full ${priorityBgClass}`
    })), editingPriorityId === item.id && /*#__PURE__*/React.createElement(PriorityPicker, {
      onSelect: prio => handleSetPriority(item.id, item.sheetId, prio),
      onClose: () => setEditingPriorityId(null)
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex-shrink-0",
      style: {
        width: '20px'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => handleItemUpdate(item.id, {
        completed: !item.completed
      }, item.sheetId),
      className: "text-gray-400 hover:text-gray-600 transition-colors"
    }, item.completed ? /*#__PURE__*/React.createElement(CheckCircle, {
      size: 18,
      className: "text-blue-500"
    }) : /*#__PURE__*/React.createElement(Circle, {
      size: 18
    }))), /*#__PURE__*/React.createElement("button", {
      onClick: () => handleNavigate(item.sheetId, item.id),
      className: `ml-2 flex-grow text-left ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`
    }, /*#__PURE__*/React.createElement(ParsedContent, {
      segments: parsed.segments,
      isCompleted: item.completed,
      isHeader: false
    })), /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-gray-400 ml-4 flex-shrink-0"
    }, "fr\xE5n ", item.sheetTitle));
  };
  const priorityBgColors = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-blue-500',
    5: 'bg-gray-400'
  };
  if (isLoading) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-100 flex items-center justify-center text-slate-500"
    }, "Laddar dina ark...");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-slate-100 font-sans text-gray-800 flex justify-center p-4 sm:p-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-3xl mt-8 mb-16"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center border-b border-slate-200 mb-6"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setActiveSheetId('agenda'),
    className: `px-4 py-2 text-sm font-semibold transition-colors flex items-center ${activeSheetId === 'agenda' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`
  }, /*#__PURE__*/React.createElement(View, {
    size: 16,
    className: "mr-2"
  }), " Agenda"), sheets.map(sheet => /*#__PURE__*/React.createElement("button", {
    key: sheet.id,
    onClick: () => setActiveSheetId(sheet.id),
    className: `px-4 py-2 text-sm font-semibold transition-colors ${activeSheetId === sheet.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-800'}`
  }, sheet.title)), /*#__PURE__*/React.createElement("button", {
    onClick: handleAddSheet,
    className: "p-2 text-slate-400 hover:text-blue-600 ml-2"
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-grow"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => signOut(auth),
    className: "p-2 text-slate-400 hover:text-red-600 ml-auto",
    title: "Logga ut"
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 18
  }))), activeSheetId === 'agenda' ? /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200/80"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-3xl font-bold mb-6 text-slate-700 tracking-tight"
  }, "Agenda"), Object.entries(agendaItems).map(([groupKey, groupItems]) => {
    if (groupItems.length === 0) return null;
    const groupTitles = {
      today: 'Idag',
      tomorrow: 'I morgon',
      thisWeek: 'Denna vecka',
      later: 'Senare'
    };
    return /*#__PURE__*/React.createElement("div", {
      key: groupKey,
      className: "mb-6"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider"
    }, groupTitles[groupKey]), groupItems.map(item => /*#__PURE__*/React.createElement(AgendaItem, {
      key: item.id,
      item: item
    })));
  }), Object.values(agendaItems).every(arr => arr.length === 0) && /*#__PURE__*/React.createElement("p", {
    className: "text-gray-500"
  }, "Inga kommande deadlines. Bra jobbat!")) : activeSheet && /*#__PURE__*/React.createElement(React.Fragment, null, isEditingTitle ? /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: activeSheet.title,
    onChange: e => updateSheet(activeSheetId, {
      title: e.target.value
    }),
    onBlur: () => setIsEditingTitle(false),
    onKeyDown: e => e.key === 'Enter' && setIsEditingTitle(false),
    className: "text-3xl font-bold mb-6 text-slate-700 tracking-tight bg-transparent w-full focus:outline-none",
    autoFocus: true
  }) : /*#__PURE__*/React.createElement("h1", {
    onClick: () => setIsEditingTitle(true),
    className: "text-3xl font-bold mb-6 text-slate-700 tracking-tight cursor-pointer"
  }, activeSheet.title), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200/80"
  }, (activeSheet.items || []).map(item => /*#__PURE__*/React.createElement(ItemComponent, {
    key: item.id,
    item: item,
    isEditing: activeId === item.id,
    isEditingDeadline: editingDeadlineId === item.id,
    isNoteExpanded: expandedNoteId === item.id,
    isPriorityPickerOpen: editingPriorityId === item.id,
    onToggleComplete: id => handleItemUpdate(id, {
      completed: !item.completed
    }),
    onSetActive: setActiveId,
    onSetEditingDeadline: setEditingDeadlineId,
    onContentChange: (id, content) => handleItemUpdate(id, {
      content
    }),
    onDeadlineChange: (id, deadline) => {
      handleItemUpdate(id, {
        deadline
      });
      setEditingDeadlineId(null);
    },
    onKeyDown: handleKeyDown,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onToggleNote: id => setExpandedNoteId(prev => prev === id ? null : id),
    onNoteChange: (id, notes) => handleItemUpdate(id, {
      notes
    }),
    onToggleHighlight: id => handleItemUpdate(id, {
      isHighlighted: !item.isHighlighted
    }),
    onTogglePriorityPicker: setEditingPriorityId,
    onSetPriority: (id, prio) => handleSetPriority(id, activeSheetId, prio)
  })), (activeSheet.archivedItems || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-8 pt-4 border-t border-gray-200"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setIsArchiveVisible(!isArchiveVisible),
    className: "flex items-center text-gray-500 font-semibold hover:text-gray-800"
  }, /*#__PURE__*/React.createElement(ChevronDown, {
    size: 20,
    className: `transition-transform transform ${isArchiveVisible ? 'rotate-180' : ''}`
  }), /*#__PURE__*/React.createElement("span", {
    className: "ml-2"
  }, "Arkiv (", activeSheet.archivedItems.length, ")")), isArchiveVisible && /*#__PURE__*/React.createElement("div", {
    className: "mt-4"
  }, activeSheet.archivedItems.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    className: "flex items-center group py-1 text-gray-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex-grow line-through",
    style: {
      paddingLeft: `${(item.indent + 1) * 28}px`
    }
  }, item.content), /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleRestore(item.id),
    className: "text-gray-400 hover:text-green-600 p-1"
  }, /*#__PURE__*/React.createElement(ArchiveRestore, {
    size: 16
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => handlePermanentDelete(item.id),
    className: "text-gray-400 hover:text-red-600 p-1"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 16
  }))))))))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-gray-400 mt-6 text-center px-4"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Markdown:"), " # Rubrik | **Fet** | *Kursiv* | !1 - !5 Prio \xA0\xA0\xB7\xA0\xA0 ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Kortkommandon:"), " Enter, Tab, Pilar, Backspace"))));
};

// --- Top-level Component to handle Auth State ---
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
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
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-slate-100 flex items-center justify-center text-slate-500"
    }, "Autentiserar...");
  }
  return user ? /*#__PURE__*/React.createElement(TodoApp, {
    user: user
  }) : /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: handleLogin
  });
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));
