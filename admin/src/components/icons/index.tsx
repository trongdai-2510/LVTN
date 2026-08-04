'use client';

/**
 * Icon adapter — re-exports Phosphor icons under their Lucide-equivalent names,
 * defaulting to weight="fill" for a consistent solid look across the admin.
 *
 * Codebase imports from '@/components/icons' instead of 'lucide-react'.
 */

import {
  Archive as PhArchive,
  ArrowBendDownRight as PhArrowBendDownRight,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowDown as PhArrowDown,
  ArrowDownLeft as PhArrowDownLeft,
  ArrowDownRight as PhArrowDownRight,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowUp as PhArrowUp,
  ArrowUpLeft as PhArrowUpLeft,
  ArrowUpRight as PhArrowUpRight,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsCounterClockwise as PhArrowsCounterClockwise,
  ArrowsLeftRight as PhArrowsLeftRight,
  ArrowsOutCardinal as PhArrowsOutCardinal,
  BellRinging as PhBellRinging,
  BookOpen as PhBookOpen,
  Briefcase as PhBriefcase,
  Buildings as PhBuildings,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  ChartBar as PhChartBar,
  ChatCircleText as PhChatCircleText,
  ChatsCircle as PhChatsCircle,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CheckSquare as PhCheckSquare,
  CircleNotch as PhCircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  CloudArrowUp as PhCloudArrowUp,
  Copy as PhCopy,
  Database as PhDatabase,
  DotsSixVertical as PhDotsSixVertical,
  DotsThree as PhDotsThree,
  DotsThreeVertical as PhDotsThreeVertical,
  DownloadSimple as PhDownloadSimple,
  Envelope as PhEnvelope,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  FacebookLogo as PhFacebookLogo,
  FileArchive as PhFileArchive,
  FileArrowDown as PhFileArrowDown,
  FileArrowUp as PhFileArrowUp,
  FileImage as PhFileImage,
  FileText as PhFileText,
  FileXls as PhFileXls,
  Flag as PhFlag,
  FloppyDisk as PhFloppyDisk,
  FunnelSimple as PhFunnelSimple,
  Gear as PhGear,
  GitBranch as PhGitBranch,
  GitFork as PhGitFork,
  GitPullRequest as PhGitPullRequest,
  Globe as PhGlobe,
  GridFour as PhGridFour,
  Handshake as PhHandshake,
  House as PhHouse,
  Image as PhImage,
  ImageBroken as PhImageBroken,
  InstagramLogo as PhInstagramLogo,
  Info as PhInfo,
  Kanban as PhKanban,
  Layout as PhLayout,
  Link as PhLink,
  LinkedinLogo as PhLinkedinLogo,
  List as PhList,
  ListBullets as PhListBullets,
  ListChecks as PhListChecks,
  ListNumbers as PhListNumbers,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  MapTrifold as PhMapTrifold,
  Minus as PhMinus,
  NavigationArrow as PhNavigationArrow,
  Newspaper as PhNewspaper,
  Package as PhPackage,
  PaperPlaneTilt as PhPaperPlaneTilt,
  PencilSimple as PhPencilSimple,
  Phone as PhPhone,
  Plus as PhPlus,
  Quotes as PhQuotes,
  Receipt as PhReceipt,
  SealCheck as PhSealCheck,
  ShareNetwork as PhShareNetwork,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldWarning as PhShieldWarning,
  SignOut as PhSignOut,
  Table as PhTable,
  Sparkle as PhSparkle,
  Stack as PhStack,
  Star as PhStar,
  Tag as PhTag,
  TextAlignCenter as PhTextAlignCenter,
  TextAlignLeft as PhTextAlignLeft,
  Trash as PhTrash,
  Tray as PhTray,
  Tree as PhTree,
  UploadSimple as PhUploadSimple,
  UserCircle as PhUserCircle,
  Users as PhUsers,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  Wrench as PhWrench,
  X as PhX,
  YoutubeLogo as PhYoutubeLogo,
  type Icon as PhosphorIcon,
  type IconProps as PhIconProps,
} from '@phosphor-icons/react';

export type LucideIcon = PhosphorIcon;

type IncomingProps = PhIconProps & { strokeWidth?: number | string };

function fill(Ph: PhosphorIcon): PhosphorIcon {
  const Wrapped = (({ strokeWidth: _sw, weight, ...rest }: IncomingProps) => (
    <Ph weight={weight ?? 'fill'} {...rest} />
  )) as unknown as PhosphorIcon;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Wrapped as any).displayName = `Filled(${(Ph as any).displayName ?? 'Icon'})`;
  return Wrapped;
}

// === Lucide-equivalent exports ===
export const AlertCircle = fill(PhWarningCircle);
export const AlertTriangle = fill(PhWarning);
export const AlignCenter = fill(PhTextAlignCenter);
export const AlignLeft = fill(PhTextAlignLeft);
export const Archive = fill(PhArchive);
export const ArchiveRestore = fill(PhArchive);
export const ArrowDown = fill(PhArrowDown);
export const ArrowDownLeft = fill(PhArrowDownLeft);
export const ArrowDownRight = fill(PhArrowDownRight);
export const ArrowLeft = fill(PhArrowLeft);
export const ArrowRight = fill(PhArrowRight);
export const ArrowRightLeft = fill(PhArrowsLeftRight);
export const ArrowUp = fill(PhArrowUp);
export const ArrowUpLeft = fill(PhArrowUpLeft);
export const ArrowUpRight = fill(PhArrowUpRight);
export const BadgeCheck = fill(PhSealCheck);
export const BarChart3 = fill(PhChartBar);
export const BellRing = fill(PhBellRinging);
export const BookOpen = fill(PhBookOpen);
export const Boxes = fill(PhStack);
export const Briefcase = fill(PhBriefcase);
export const Building2 = fill(PhBuildings);
export const Check = fill(PhCheck);
export const CheckCircle2 = fill(PhCheckCircle);
export const CheckSquare2 = fill(PhCheckSquare);
export const ChevronDown = fill(PhCaretDown);
export const ChevronLeft = fill(PhCaretLeft);
export const ChevronRight = fill(PhCaretRight);
export const ChevronUp = fill(PhCaretUp);
export const ClipboardList = fill(PhClipboardText);
export const Clock = fill(PhClock);
export const Clock3 = fill(PhClock);
export const CloudUpload = fill(PhCloudArrowUp);
export const Copy = fill(PhCopy);
export const CornerDownRight = fill(PhArrowBendDownRight);
export const Database = fill(PhDatabase);
export const DatabaseZap = fill(PhDatabase);
export const Download = fill(PhDownloadSimple);
export const ExternalLink = fill(PhArrowSquareOut);
export const Eye = fill(PhEye);
export const EyeOff = fill(PhEyeSlash);
export const Facebook = fill(PhFacebookLogo);
export const FileArchive = fill(PhFileArchive);
export const FileCheck2 = fill(PhFileText);
export const FileDown = fill(PhFileArrowDown);
export const FileImage = fill(PhFileImage);
export const FileSpreadsheet = fill(PhFileXls);
export const FileText = fill(PhFileText);
export const FileUp = fill(PhFileArrowUp);
export const Filter = fill(PhFunnelSimple);
export const Flag = fill(PhFlag);
export const FolderKanban = fill(PhKanban);
export const FolderTree = fill(PhTree);
export const GalleryHorizontal = fill(PhImage);
export const GitBranchPlus = fill(PhGitBranch);
export const GitFork = fill(PhGitFork);
export const GitPullRequest = fill(PhGitPullRequest);
export const Globe2 = fill(PhGlobe);
export const Grid3X3 = fill(PhGridFour);
export const GripVertical = fill(PhDotsSixVertical);
export const Handshake = fill(PhHandshake);
export const History = fill(PhClockCounterClockwise);
export const Home = fill(PhHouse);
export const Image = fill(PhImage);
export const ImageIcon = fill(PhImage);
export const ImageOff = fill(PhImageBroken);
export const Table = fill(PhTable);
export const Inbox = fill(PhTray);
export const Info = fill(PhInfo);
export const Instagram = fill(PhInstagramLogo);
export const Layers = fill(PhStack);
export const Layers3 = fill(PhStack);
export const LayoutGrid = fill(PhGridFour);
export const Link2 = fill(PhLink);
export const Linkedin = fill(PhLinkedinLogo);
export const List = fill(PhList);
export const ListChecks = fill(PhListChecks);
export const ListOrdered = fill(PhListNumbers);
export const ListTree = fill(PhListBullets);
export const Loader2 = fill(PhCircleNotch);
export const LogOut = fill(PhSignOut);
export const Mail = fill(PhEnvelope);
export const MapPin = fill(PhMapPin);
export const Menu = fill(PhList);
export const MessageSquare = fill(PhChatCircleText);
export const MessagesSquare = fill(PhChatsCircle);
export const Minus = fill(PhMinus);
export const MoreHorizontal = fill(PhDotsThree);
export const MoreVertical = fill(PhDotsThreeVertical);
export const Move = fill(PhArrowsOutCardinal);
export const Navigation = fill(PhNavigationArrow);
export const Newspaper = fill(PhNewspaper);
export const Package = fill(PhPackage);
export const PackageSearch = fill(PhPackage);
export const PanelsTopLeft = fill(PhLayout);
export const Pencil = fill(PhPencilSimple);
export const Phone = fill(PhPhone);
export const Plus = fill(PhPlus);
export const Quote = fill(PhQuotes);
export const ReceiptText = fill(PhReceipt);
export const RefreshCcw = fill(PhArrowsCounterClockwise);
export const RefreshCw = fill(PhArrowsClockwise);
export const RotateCcw = fill(PhArrowCounterClockwise);
export const Route = fill(PhMapTrifold);
export const Save = fill(PhFloppyDisk);
export const Search = fill(PhMagnifyingGlass);
export const Send = fill(PhPaperPlaneTilt);
export const Settings = fill(PhGear);
export const Share2 = fill(PhShareNetwork);
export const Shield = fill(PhShield);
export const ShieldAlert = fill(PhShieldWarning);
export const ShieldCheck = fill(PhShieldCheck);
export const Sparkles = fill(PhSparkle);
export const Star = fill(PhStar);
export const Tag = fill(PhTag);
export const Tags = fill(PhTag);
export const Trash2 = fill(PhTrash);
export const TriangleAlert = fill(PhWarning);
export const Upload = fill(PhUploadSimple);
export const UploadCloud = fill(PhCloudArrowUp);
export const UserRound = fill(PhUserCircle);
export const Users = fill(PhUsers);
export const Wrench = fill(PhWrench);
export const X = fill(PhX);
export const Youtube = fill(PhYoutubeLogo);
