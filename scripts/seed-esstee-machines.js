/**
 * Comprehensive Seed Script for Esstee Exports India Pvt Ltd
 * Machine List HO (342 machines from October 2026 registry)
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const rawRows = [
  // Page 1: S.NO 1 to 40
  { sno: 1, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF17785', idNo: 'A-001', year: '2013' },
  { sno: 2, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22537', idNo: 'A-002', year: '2013' },
  { sno: 3, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22523', idNo: 'A-003', year: '2013' },
  { sno: 4, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF17773', idNo: 'A-004', year: '2013' },
  { sno: 5, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF17780', idNo: 'A-005', year: '2013' },
  { sno: 6, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22702', idNo: 'A-006', year: '2013' },
  { sno: 7, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22547', idNo: 'A-007', year: '2013' },
  { sno: 8, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22669', idNo: 'A-008', year: '2013' },
  { sno: 9, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22668', idNo: 'A-009', year: '2013' },
  { sno: 10, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22695', idNo: 'A-010', year: '2013' },
  { sno: 11, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22678', idNo: 'A-011', year: '2013' },
  { sno: 12, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22697', idNo: 'A-012', year: '2013' },
  { sno: 13, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22672', idNo: 'A-013', year: '2013' },
  { sno: 14, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22542', idNo: 'A-014', year: '2013' },
  { sno: 15, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22663', idNo: 'A-015', year: '2013' },
  { sno: 16, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22688', idNo: 'A-016', year: '2013' },
  { sno: 17, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22670', idNo: 'A-017', year: '2013' },
  { sno: 18, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22539', idNo: 'A-018', year: '2013' },
  { sno: 19, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF21812', idNo: 'A-019', year: '2013' },
  { sno: 20, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22552', idNo: 'A-020', year: '2013' },
  { sno: 21, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22546', idNo: 'A-021', year: '2013' },
  { sno: 22, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF21850', idNo: 'A-022', year: '2013' },
  { sno: 23, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22685', idNo: 'A-023', year: '2013' },
  { sno: 24, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22683', idNo: 'A-024', year: '2013' },
  { sno: 25, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22659', idNo: 'A-025', year: '2013' },
  { sno: 26, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22532', idNo: 'A-026', year: '2013' },
  { sno: 27, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22666', idNo: 'A-027', year: '2013' },
  { sno: 28, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF17776', idNo: 'A-028', year: '2013' },
  { sno: 29, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF19884', idNo: 'A-029', year: '2013' },
  { sno: 30, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22660', idNo: 'A-030', year: '2013' },
  { sno: 31, type: 'OVER LOCK', company: 'YAMATO', model: 'AZ1725SD-Y5DF-8', slNo: 'PF22661', idNo: 'A-031', year: '2013' },
  { sno: 32, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89153', idNo: 'A-034', year: '2010' },
  { sno: 33, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89025', idNo: 'A-035', year: '2010' },
  { sno: 34, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89168', idNo: 'A-036', year: '2010' },
  { sno: 35, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89014', idNo: 'A-037', year: '2010' },
  { sno: 36, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN88922', idNo: 'A-039', year: '2010' },
  { sno: 37, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89017', idNo: 'A-040', year: '2010' },
  { sno: 38, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN89005', idNo: 'A-041', year: '2010' },
  { sno: 39, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN88992', idNo: 'A-043', year: '2010' },
  { sno: 40, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157835', idNo: 'A-044', year: '2019' },

  // Page 2: S.NO 41 to 45
  { sno: 41, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN158001', idNo: 'A-045', year: '2019' },
  { sno: 42, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157710', idNo: 'A-046', year: '2019' },
  { sno: 43, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN158004', idNo: 'A-047', year: '2019' },
  { sno: 44, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN158005', idNo: 'A-048', year: '2019' },
  { sno: 45, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157826', idNo: 'A-049', year: '2019' },

  // Page 3: S.NO 46 to 85
  { sno: 46, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157942', idNo: 'A-050', year: '2019' },
  { sno: 47, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157982', idNo: 'A-051', year: '2019' },
  { sno: 48, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157829', idNo: 'A-052', year: '2019' },
  { sno: 49, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157832', idNo: 'A-053', year: '2019' },
  { sno: 50, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157989', idNo: 'A-054', year: '2019' },
  { sno: 51, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157827', idNo: 'A-055', year: '2019' },
  { sno: 52, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157845', idNo: 'A-056', year: '2019' },
  { sno: 53, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157961', idNo: 'A-057', year: '2019' },
  { sno: 54, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157838', idNo: 'A-058', year: '2019' },
  { sno: 55, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157864', idNo: 'A-059', year: '2019' },
  { sno: 56, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157988', idNo: 'A-060', year: '2019' },
  { sno: 57, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157972', idNo: 'A-061', year: '2019' },
  { sno: 58, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157891', idNo: 'A-062', year: '2019' },
  { sno: 59, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157689', idNo: 'A-063', year: '2019' },
  { sno: 60, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157998', idNo: 'A-064', year: '2019' },
  { sno: 61, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157978', idNo: 'A-065', year: '2019' },
  { sno: 62, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157981', idNo: 'A-066', year: '2019' },
  { sno: 63, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157833', idNo: 'A-067', year: '2019' },
  { sno: 64, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157992', idNo: 'A-068', year: '2019' },
  { sno: 65, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157986', idNo: 'A-069', year: '2019' },
  { sno: 66, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157974', idNo: 'A-070', year: '2019' },
  { sno: 67, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157719', idNo: 'A-071', year: '2019' },
  { sno: 68, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157882', idNo: 'A-072', year: '2019' },
  { sno: 69, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN157997', idNo: 'A-073', year: '2019' },
  { sno: 70, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN170376', idNo: 'A-074', year: '2018' },
  { sno: 71, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN177054', idNo: 'A-075', year: '2018' },
  { sno: 72, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN179371', idNo: 'A-076', year: '2018' },
  { sno: 73, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN170404', idNo: 'A-077', year: '2018' },
  { sno: 74, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN179530', idNo: 'A-078', year: '2018' },
  { sno: 75, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN179475', idNo: 'A-079', year: '2018' },
  { sno: 76, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN177032', idNo: 'A-080', year: '2018' },
  { sno: 77, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN170403', idNo: 'A-081', year: '2018' },
  { sno: 78, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN170388', idNo: 'A-082', year: '2018' },
  { sno: 79, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN176656', idNo: 'A-083', year: '2018' },
  { sno: 80, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN177023', idNo: 'A-084', year: '2018' },
  { sno: 81, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN177266', idNo: 'A-085', year: '2018' },
  { sno: 82, type: 'OVER LOCK', company: 'YAMATO', model: 'CZ6125-Y5DF/K2', slNo: 'TN170408', idNo: 'A-086', year: '2018' },
  { sno: 83, type: 'OVER LOCK', company: 'SIRUBA', model: '747K', slNo: '12028375', idNo: 'A-096', year: '2009' },
  { sno: 84, type: 'OVER LOCK', company: 'SIRUBA', model: '747K', slNo: '12028162', idNo: 'A-097', year: '2009' },
  { sno: 85, type: 'OVER LOCK', company: 'SIRUBA', model: '747K', slNo: '12028802', idNo: 'A-098', year: '2009' },

  // Page 4: S.NO 86 to 127
  { sno: 86, type: 'OVER LOCK', company: 'YAMATO', model: 'AZF-8420-Y5DF/K2', slNo: 'YN68746', idNo: 'A-101', year: '2017' },
  { sno: 87, type: 'OVER LOCK', company: 'YAMATO', model: 'AZF-8420-Y5DF/K2', slNo: 'YN68734', idNo: 'A-102', year: '2017' },
  { sno: 88, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG14097', idNo: 'A-105', year: '2013' },
  { sno: 89, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG12547', idNo: 'A-106', year: '2013' },
  { sno: 90, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG17206', idNo: 'A-107', year: '2017' },
  { sno: 91, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG13242', idNo: 'A-108', year: '2013' },
  { sno: 92, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG14085', idNo: 'A-109', year: '2013' },
  { sno: 93, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG13243', idNo: 'A-110', year: '2013' },
  { sno: 94, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG12543', idNo: 'A-111', year: '2013' },
  { sno: 95, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG14092', idNo: 'A-112', year: '2013' },
  { sno: 96, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG12379', idNo: 'A-113', year: '2013' },
  { sno: 97, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG14096', idNo: 'A-114', year: '2013' },
  { sno: 98, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG17139', idNo: 'A-115', year: '2017' },
  { sno: 99, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG17207', idNo: 'A-117', year: '2017' },
  { sno: 100, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG17141', idNo: 'A-118', year: '2017' },
  { sno: 101, type: 'FLAT LOCK B/H', company: 'YAMATO', model: 'VG3511-156S1-8F', slNo: 'GG17210', idNo: 'A-119', year: '2017' },
  { sno: 102, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34145', idNo: 'A-120', year: '2013' },
  { sno: 103, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA44193', idNo: 'A-121', year: '2013' },
  { sno: 104, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34913', idNo: 'A-122', year: '2013' },
  { sno: 105, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34992', idNo: 'A-123', year: '2013' },
  { sno: 106, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA43079', idNo: 'A-124', year: '2013' },
  { sno: 107, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34991', idNo: 'A-125', year: '2013' },
  { sno: 108, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA44192', idNo: 'A-126', year: '2013' },
  { sno: 109, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34151', idNo: 'A-127', year: '2013' },
  { sno: 110, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA44184', idNo: 'A-128', year: '2013' },
  { sno: 111, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA39215', idNo: 'A-129', year: '2013' },
  { sno: 112, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA39210', idNo: 'A-130', year: '2013' },
  { sno: 113, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA39235', idNo: 'A-131', year: '2013' },
  { sno: 114, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA43083', idNo: 'A-132', year: '2013' },
  { sno: 115, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA39201', idNo: 'A-133', year: '2013' },
  { sno: 116, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD16652', idNo: 'A-134', year: '2013' },
  { sno: 117, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD14236', idNo: 'A-135', year: '2013' },
  { sno: 118, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD16648', idNo: 'A-137', year: '2013' },
  { sno: 119, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD16661', idNo: 'A-138', year: '2013' },
  { sno: 120, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD16647', idNo: 'A-139', year: '2013' },
  { sno: 121, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'AD21741', idNo: 'A-140', year: '2017' },
  { sno: 122, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'AD21734', idNo: 'A-141', year: '2017' },
  { sno: 123, type: 'FLAT LOCK CYLINDER BED', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'AD25235', idNo: 'A-142', year: '2017' },
  { sno: 124, type: 'FLAT LOCK CYLINDER BED PULLER', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'AD22106', idNo: 'A-143', year: '2017' },
  { sno: 125, type: 'FLAT LOCK CYLINDER BED PULLER', company: 'YAMATO', model: 'VC2713G-156M-K4N-8F', slNo: 'GD16655', idNo: 'A-144', year: '2013' },
  { sno: 126, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N-8F', slNo: 'VE88730', idNo: 'A-145', year: '2018' },
  { sno: 127, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N-8F', slNo: 'VE88729', idNo: 'A-146', year: '2018' },

  // Page 5: S.NO 128 to 129
  { sno: 128, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N-8F', slNo: 'VE88737', idNo: 'A-147', year: '2018' },
  { sno: 129, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N-8F', slNo: 'VE87551', idNo: 'A-150', year: '2018' },

  // Page 6: S.NO 130 to 167
  { sno: 130, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N-8F', slNo: 'VE87558', idNo: 'A-151', year: '2018' },
  { sno: 131, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N', slNo: 'PW80552', idNo: 'A-152', year: '2009' },
  { sno: 132, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N', slNo: 'PW80557', idNo: 'A-153', year: '2009' },
  { sno: 133, type: 'FLAT LOCK SMALL CYLINDER BED', company: 'YAMATO', model: 'VE2713-156-2K4N', slNo: 'PW80553', idNo: 'A-154', year: '2009' },
  { sno: 134, type: 'FLAT LOCK CYLINDER BED', company: 'PEGASUS', model: 'W600', slNo: '0183845', idNo: 'A-155', year: '2009' },
  { sno: 135, type: 'FLAT LOCK FLAT BED', company: 'PEGASUS', model: 'W1500', slNo: '0186700', idNo: 'A-162', year: '2009' },
  { sno: 136, type: 'FLAT LOCK FLAT BED', company: 'PEGASUS', model: 'W1500', slNo: '0116999', idNo: 'A-164', year: '2009' },
  { sno: 137, type: 'FLAT LOCK VT', company: 'YAMATO', model: 'VT2500', slNo: 'PY31325', idNo: 'A-169', year: '2013' },
  { sno: 138, type: 'FLAT LOCK VT', company: 'YAMATO', model: 'VT2500', slNo: 'PY31326', idNo: 'A-170', year: '2013' },
  { sno: 139, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95270', idNo: 'A-171', year: '2013' },
  { sno: 140, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95321', idNo: 'A-172', year: '2013' },
  { sno: 141, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95289', idNo: 'A-173', year: '2013' },
  { sno: 142, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95261', idNo: 'A-175', year: '2013' },
  { sno: 143, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95374', idNo: 'A-176', year: '2013' },
  { sno: 144, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95371', idNo: 'A-177', year: '2013' },
  { sno: 145, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95339', idNo: 'A-178', year: '2013' },
  { sno: 146, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95271', idNo: 'A-179', year: '2013' },
  { sno: 147, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95263', idNo: 'A-180', year: '2013' },
  { sno: 148, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95306', idNo: 'A-181', year: '2013' },
  { sno: 149, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95256', idNo: 'A-182', year: '2013' },
  { sno: 150, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95299', idNo: 'A-183', year: '2013' },
  { sno: 151, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95351', idNo: 'A-184', year: '2013' },
  { sno: 152, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95281', idNo: 'A-185', year: '2013' },
  { sno: 153, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95260', idNo: 'A-186', year: '2013' },
  { sno: 154, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H94973', idNo: 'A-187', year: '2013' },
  { sno: 155, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H94938', idNo: 'A-188', year: '2013' },
  { sno: 156, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95279', idNo: 'A-189', year: '2013' },
  { sno: 157, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H94929', idNo: 'A-190', year: '2013' },
  { sno: 158, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95320', idNo: 'A-191', year: '2013' },
  { sno: 159, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95342', idNo: 'A-192', year: '2013' },
  { sno: 160, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H94917', idNo: 'A-193', year: '2013' },
  { sno: 161, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95330', idNo: 'A-194', year: '2013' },
  { sno: 162, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L1H95248', idNo: 'A-195', year: '2013' },
  { sno: 163, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L2H67178', idNo: 'A-196', year: '2013' },
  { sno: 164, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L2H67172', idNo: 'A-197', year: '2013' },
  { sno: 165, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L2H67140', idNo: 'A-198', year: '2013' },
  { sno: 166, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L2H67120', idNo: 'A-199', year: '2013' },
  { sno: 167, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'L2H67090', idNo: 'A-200', year: '2013' },

  // Page 7: S.NO 168 to 209
  { sno: 168, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56495', idNo: 'A-201', year: '2013' },
  { sno: 169, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56695', idNo: 'A-202', year: '2013' },
  { sno: 170, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56671', idNo: 'A-203', year: '2013' },
  { sno: 171, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56706', idNo: 'A-204', year: '2013' },
  { sno: 172, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56682', idNo: 'A-205', year: '2013' },
  { sno: 173, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56669', idNo: 'A-206', year: '2013' },
  { sno: 174, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56699', idNo: 'A-207', year: '2013' },
  { sno: 175, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56536', idNo: 'A-208', year: '2013' },
  { sno: 176, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56664', idNo: 'A-209', year: '2013' },
  { sno: 177, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56704', idNo: 'A-210', year: '2013' },
  { sno: 178, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56516', idNo: 'A-211', year: '2013' },
  { sno: 179, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56687', idNo: 'A-212', year: '2013' },
  { sno: 180, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56647', idNo: 'A-213', year: '2013' },
  { sno: 181, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56670', idNo: 'A-214', year: '2013' },
  { sno: 182, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56737', idNo: 'A-215', year: '2013' },
  { sno: 183, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56545', idNo: 'A-216', year: '2013' },
  { sno: 184, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H56688', idNo: 'A-217', year: '2013' },
  { sno: 185, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'J2H58842', idNo: 'A-218', year: '2013' },
  { sno: 186, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'K2H64264', idNo: 'A-219', year: '2013' },
  { sno: 187, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'K2H63912', idNo: 'A-220', year: '2013' },
  { sno: 188, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'K2H63744', idNo: 'A-221', year: '2013' },
  { sno: 189, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'K2H64242', idNo: 'A-222', year: '2013' },
  { sno: 190, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'K2H63646', idNo: 'A-223', year: '2013' },
  { sno: 191, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'A6Z66141', idNo: 'A-224', year: '2013' },
  { sno: 192, type: 'SINGER', company: 'BROTHER', model: 'S-6200DD-403', slNo: 'A6Z66320', idNo: 'A-226', year: '2013' },
  { sno: 193, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H50093', idNo: 'A-227', year: '2013' },
  { sno: 194, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H48944', idNo: 'A-228', year: '2013' },
  { sno: 195, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H50155', idNo: 'A-229', year: '2013' },
  { sno: 196, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H48900', idNo: 'A-230', year: '2013' },
  { sno: 197, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H50144', idNo: 'A-231', year: '2013' },
  { sno: 198, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H50011', idNo: 'A-232', year: '2013' },
  { sno: 199, type: 'SINGER', company: 'BROTHER', model: 'S-6200A-303', slNo: 'K9H50104', idNo: 'A-233', year: '2013' },
  { sno: 200, type: 'SINGER', company: 'BROTHER', model: 'S-7250A-403', slNo: 'J7Z28784', idNo: 'A-234', year: '2019' },
  { sno: 201, type: 'SINGER', company: 'BROTHER', model: 'S-7250A-403', slNo: 'J7Z28777', idNo: 'A-235', year: '2019' },
  { sno: 202, type: 'SINGER', company: 'BROTHER', model: 'S-7250A-403', slNo: 'J7Z28789', idNo: 'A-236', year: '2019' },
  { sno: 203, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51907', idNo: 'A-237', year: '2017' },
  { sno: 204, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51914', idNo: 'A-238', year: '2017' },
  { sno: 205, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51904', idNo: 'A-239', year: '2017' },
  { sno: 206, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52505', idNo: 'A-240', year: '2017' },
  { sno: 207, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51876', idNo: 'A-241', year: '2017' },
  { sno: 208, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52386', idNo: 'A-242', year: '2017' },
  { sno: 209, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52179', idNo: 'A-243', year: '2017' },

  // Page 8: S.NO 210 to 215
  { sno: 210, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51878', idNo: 'A-244', year: '2017' },
  { sno: 211, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52504', idNo: 'A-245', year: '2017' },
  { sno: 212, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52087', idNo: 'A-246', year: '2017' },
  { sno: 213, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z51960', idNo: 'A-247', year: '2017' },
  { sno: 214, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52086', idNo: 'A-249', year: '2017' },
  { sno: 215, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52084', idNo: 'A-250', year: '2017' },

  // Page 9: S.NO 216 to 257
  { sno: 216, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'M5Z52529', idNo: 'A-251', year: '2017' },
  { sno: 217, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'C7Z57939', idNo: 'A-252', year: '2017' },
  { sno: 218, type: 'SINGER', company: 'BROTHER', model: 'S-7300A-403P', slNo: 'C7Z57984', idNo: 'A-253', year: '2017' },
  { sno: 219, type: 'SINGER', company: 'SIRIBA', model: 'L818F-M1', slNo: '365622', idNo: 'A-254', year: '2005' },
  { sno: 220, type: 'FLAT LOCK FLAT BED', company: 'YAMATO', model: 'CF2300M-153M', slNo: 'HA34995', idNo: 'A-255', year: '2013' },
  { sno: 221, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML040032', idNo: 'A-258', year: '2024' },
  { sno: 222, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML040298', idNo: 'A-259', year: '2024' },
  { sno: 223, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML040246', idNo: 'A-260', year: '2024' },
  { sno: 224, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML040260', idNo: 'A-261', year: '2024' },
  { sno: 225, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML130021', idNo: 'A-262', year: '2024' },
  { sno: 226, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24', slNo: 'SNC280176', idNo: 'A-263', year: '2024' },
  { sno: 227, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24', slNo: 'SNC220048', idNo: 'A-264', year: '2024' },
  { sno: 228, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24', slNo: 'SND010062', idNo: 'A-265', year: '2024' },
  { sno: 229, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24', slNo: 'SND010012', idNo: 'A-266', year: '2024' },
  { sno: 230, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24', slNo: 'SNA080444', idNo: 'A-267', year: '2024' },
  { sno: 231, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090044', idNo: 'A-268', year: '2025' },
  { sno: 232, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090092', idNo: 'A-269', year: '2025' },
  { sno: 233, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090109', idNo: 'A-270', year: '2025' },
  { sno: 234, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090067', idNo: 'A-271', year: '2025' },
  { sno: 235, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090078', idNo: 'A-272', year: '2025' },
  { sno: 236, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE090113', idNo: 'A-273', year: '2025' },
  { sno: 237, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE180115', idNo: 'A-274', year: '2025' },
  { sno: 238, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE180128', idNo: 'A-275', year: '2025' },
  { sno: 239, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SNE180150', idNo: 'A-276', year: '2025' },
  { sno: 240, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C', slNo: 'SME040170', idNo: 'A-277', year: '2025' },
  { sno: 241, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C/MDK', slNo: 'SNE290026', idNo: 'A-278', year: '2025' },
  { sno: 242, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-03/333/24C/MDK', slNo: 'SNF060127', idNo: 'A-279', year: '2025' },
  { sno: 243, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210002', idNo: 'A-280', year: '2025' },
  { sno: 244, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210003', idNo: 'A-281', year: '2025' },
  { sno: 245, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210004', idNo: 'A-282', year: '2025' },
  { sno: 246, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210007', idNo: 'A-283', year: '2025' },
  { sno: 247, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210010', idNo: 'A-284', year: '2025' },
  { sno: 248, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210011', idNo: 'A-285', year: '2025' },
  { sno: 249, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNG220012', idNo: 'A-286', year: '2025' },
  { sno: 250, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210016', idNo: 'A-287', year: '2025' },
  { sno: 251, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNG220019', idNo: 'A-288', year: '2025' },
  { sno: 252, type: 'OVER LOCK', company: 'SUPREME', model: 'S5F/4-83/323-24/AT/BK', slNo: 'SNK210020', idNo: 'A-289', year: '2025' },
  { sno: 253, type: 'FLAT LOCK RING ELESTIC', company: 'KINGTEX', model: 'CTD9085', slNo: '22500677', idNo: 'A-290', year: '2025' },
  { sno: 254, type: 'FLAT LOCK CUT BED', company: 'KINGTEX', model: 'FTD7003-03-356M/MN', slNo: '32400031', idNo: 'A-291', year: '2025' },
  { sno: 255, type: 'FLAT LOCK CUT BED', company: 'KINGTEX', model: 'FTD7003-03-356M/MN', slNo: '32400032', idNo: 'A-292', year: '2025' },
  { sno: 256, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500651', idNo: 'A-293', year: '2025' },
  { sno: 257, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500656', idNo: 'A-294', year: '2025' },

  // Page 10: S.NO 258 to 263
  { sno: 258, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500657', idNo: 'A-295', year: '2025' },
  { sno: 259, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500659', idNo: 'A-296', year: '2025' },
  { sno: 260, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500660', idNo: 'A-297', year: '2025' },
  { sno: 261, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500661', idNo: 'A-298', year: '2025' },
  { sno: 262, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '22500663', idNo: 'A-299', year: '2025' },
  { sno: 263, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2231821', idNo: 'A-300', year: '2025' },

  // Page 11: S.NO 264 to 303
  { sno: 264, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2231822', idNo: 'A-301', year: '2025' },
  { sno: 265, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2231824', idNo: 'A-302', year: '2025' },
  { sno: 266, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2231825', idNo: 'A-303', year: '2025' },
  { sno: 267, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500665', idNo: 'A-304', year: '2025' },
  { sno: 268, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500666', idNo: 'A-305', year: '2025' },
  { sno: 269, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500670', idNo: 'A-306', year: '2025' },
  { sno: 270, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500672', idNo: 'A-307', year: '2025' },
  { sno: 271, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500673', idNo: 'A-308', year: '2025' },
  { sno: 272, type: 'FLAT LOCK CYLINDER BED', company: 'KINGTEX', model: 'CTD9000', slNo: '22500668', idNo: 'A-309', year: '2025' },
  { sno: 273, type: 'FLAT LOCK FLAT BED', company: 'KINGTEX', model: 'FTD7000', slNo: '32300507', idNo: 'A-310', year: '2025' },
  { sno: 274, type: 'FLAT LOCK FLAT BED', company: 'KINGTEX', model: 'FTD7000', slNo: '32300508', idNo: 'A-311', year: '2025' },
  { sno: 275, type: 'FLAT LOCK FLAT BED', company: 'KINGTEX', model: 'FTD7000', slNo: '32300509', idNo: 'A-312', year: '2025' },
  { sno: 276, type: 'FLAT LOCK FLAT BED', company: 'KINGTEX', model: 'FTD7000', slNo: '32300510', idNo: 'A-313', year: '2025' },
  { sno: 277, type: 'FLAT LOCK FLAT BED', company: 'KINGTEX', model: 'FTD7000', slNo: '32300511', idNo: 'A-314', year: '2025' },
  { sno: 278, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2240877', idNo: 'A-315', year: '2026' },
  { sno: 279, type: 'FLAT LOCK B/H', company: 'KINGTEX', model: 'CTD9811', slNo: '2240879', idNo: 'A-316', year: '2026' },
  { sno: 280, type: 'LFC OVER LOCK', company: 'SIRUBA', model: '747K', slNo: '12028277', idNo: 'A-317', year: '2009' },
  { sno: 281, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML250677', idNo: 'A-318', year: '2026' },
  { sno: 282, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML250731', idNo: 'A-319', year: '2026' },
  { sno: 283, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML250708', idNo: 'A-320', year: '2026' },
  { sno: 284, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML250607', idNo: 'A-321', year: '2026' },
  { sno: 285, type: 'SINGER', company: 'SUPREME', model: 'SP-H5-M', slNo: 'DML250572', idNo: 'A-322', year: '2026' },
  { sno: 286, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20190825002', idNo: 'A-S03', year: '2019' },
  { sno: 287, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20190825004', idNo: 'A-S04', year: '2019' },
  { sno: 288, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20190825005', idNo: 'A-S05', year: '2019' },
  { sno: 289, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20190825007', idNo: 'A-S06', year: '2019' },
  { sno: 290, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20171105008', idNo: 'A-S07', year: '2017' },
  { sno: 291, type: 'DOUBLE NEEDLE', company: 'NISO', model: 'NJ-3800DD', slNo: 'FSC20171105009', idNo: 'A-S08', year: '2017' },
  { sno: 292, type: 'DRIMMER', company: 'KANSAI', model: 'FX4406P', slNo: '1909152', idNo: 'A-S09', year: '2019' },
  { sno: 293, type: 'BUTTON', company: 'BROTHER', model: 'BE-438FX', slNo: 'K4Z36564', idNo: 'A-S11', year: '2018' },
  { sno: 294, type: 'BARTACK', company: 'BROTHER', model: 'KE430F-03', slNo: 'L2Z24263', idNo: 'A-S12', year: '2017' },
  { sno: 295, type: 'KAJA', company: 'BROTHER', model: 'HE-800A-3', slNo: 'G8Z56671', idNo: 'A-S13', year: '2008' },
  { sno: 296, type: 'KAJA', company: 'BROTHER', model: 'HE-800B-3', slNo: 'D8851340', idNo: 'A-S14', year: '2018' },
  { sno: 297, type: 'AIR SNAP BUTTON', company: 'PRYM', model: 'VS', slNo: 'VS2690', idNo: 'A-S29', year: '2017' },
  { sno: 298, type: 'AIR SNAP BUTTON', company: 'PRYM', model: 'VS', slNo: 'VS2691', idNo: 'A-S30', year: '2017' },
  { sno: 299, type: 'SNAP BUTTON', company: 'SCOVILL', model: 'C5A', slNo: '40331', idNo: 'A-S31', year: '2009' },
  { sno: 300, type: 'BIG BED FUSING', company: 'BHARATH', model: 'BSF1620', slNo: '240809', idNo: 'A-S32', year: '2024' },
  { sno: 301, type: 'PETANTECKER', company: 'HOSHIMA', model: 'HSM-2210GT-02A/CH', slNo: '24062601', idNo: 'A-S33', year: '2024' },
  { sno: 302, type: 'RIP CUTTING', company: 'DINO', model: 'LU-933', slNo: '001', idNo: 'A-S34', year: '2016' },
  { sno: 303, type: 'RIP CUTTING', company: 'DINO', model: 'LU-933', slNo: '002', idNo: 'A-S35', year: '2016' },

  // Page 12: S.NO 304 to 342
  { sno: 304, type: 'DOUBLE BED FUSING', company: 'BHARATH', model: 'BDB66', slNo: '190523', idNo: 'A-S36', year: '2017' },
  { sno: 305, type: 'DOUBLE BED FUSING', company: 'BHARATH', model: 'BDB66', slNo: '190524', idNo: 'A-S37', year: '2017' },
  { sno: 306, type: 'SMALL HAND FUSING', company: 'BHARATH', model: 'BMF43', slNo: '190929', idNo: 'A-S38', year: '2017' },
  { sno: 307, type: 'BIG BED FUSING', company: 'BHARATH', model: 'BSF1620', slNo: '180314', idNo: 'A-S39', year: '2018' },
  { sno: 308, type: 'BIG BED FUSING', company: 'BHARATH', model: 'BSF1620', slNo: '180910', idNo: 'A-S40', year: '2018' },
  { sno: 309, type: 'ROLL FUSING', company: 'OSIMA', model: 'HP-400CS', slNo: 'NO NUMBER', idNo: 'A-S42', year: '2017' },
  { sno: 310, type: 'CONE WINDING M/C', company: 'DMC', model: 'OW-40C', slNo: 'NO NUMBER', idNo: 'A-S46', year: '2016' },
  { sno: 311, type: 'NEEDLE DETECTOR', company: 'OSIMA', model: '688CD5', slNo: '20190682', idNo: 'A-S47', year: '2017' },
  { sno: 312, type: 'BAND KNIFE', company: 'SAN.V', model: 'SK-900', slNo: '0333237', idNo: 'A-S48', year: '2017' },
  { sno: 313, type: 'BAND KNIFE', company: 'SAN.V', model: 'SK-900', slNo: '0333488', idNo: 'A-S49', year: '2017' },
  { sno: 314, type: 'BAND KNIFE', company: 'K.M', model: 'KBK-900', slNo: '03109', idNo: 'A-S50', year: '2009' },
  { sno: 315, type: 'STRAIGHT KNIFE', company: 'K.M', model: 'KS-AU V', slNo: '161911', idNo: 'A-S51', year: '2013' },
  { sno: 316, type: 'STRAIGHT KNIFE', company: 'ORBITO', model: 'ORB-SK', slNo: 'SN-AS52', idNo: 'A-S52', year: '2013' },
  { sno: 317, type: 'PATEN MARKING', company: 'MORGAN', model: 'LEONARDO 180', slNo: 'RJ0L7', idNo: 'A-S56', year: '2016' },
  { sno: 318, type: 'PATEN CUTTING M/C', company: 'WINDA', model: 'WD-FJ1509', slNo: '18041412B', idNo: 'A-S57', year: '2018' },
  { sno: 319, type: 'ZIJZAG', company: 'RANEW', model: '130 DX-1000', slNo: '252720', idNo: 'A-S60', year: '2022' },
  { sno: 320, type: 'PATEN CUTTING M/C', company: 'JIANGSU', model: 'POPJET1800-G', slNo: '22SGF11003', idNo: 'A-S61', year: '2023' },
  { sno: 321, type: 'CONE WINDING M/C', company: 'DMC', model: '40C', slNo: '200080110', idNo: 'A-S62', year: '2023' },
  { sno: 322, type: 'DOUBLE BED FUSING', company: 'BHARATH', model: 'BDB66', slNo: '231211', idNo: 'A-S63', year: '2023' },
  { sno: 323, type: 'SMALL HAND FUSING', company: 'BHARATH', model: 'BMF43', slNo: 'SN-AS64', idNo: 'A-S64', year: '2015' },
  { sno: 324, type: 'NEEDLE STEWARD MACHINE', company: 'HOSHIMA', model: 'HSM-A8', slNo: '898019', idNo: 'A-S67', year: '2024' },
  { sno: 325, type: 'PETANTECKER', company: 'SUPREME', model: 'SP-1510BS-M/CH', slNo: '1016NJ1501', idNo: 'A-S68', year: '2024' },
  { sno: 326, type: 'FLAT SEAMER', company: 'KINGTEX', model: 'NTD6712-H6', slNo: '92500501', idNo: 'A-S69', year: '2025' },
  { sno: 327, type: 'FLAT SEAMER', company: 'KINGTEX', model: 'NTD6712-H6', slNo: '92500503', idNo: 'A-S70', year: '2025' },
  { sno: 328, type: 'FUSHING MACHINE', company: 'BHARATH', model: 'BDB1215TS', slNo: '250531', idNo: 'A-S71', year: '2025' },
  { sno: 329, type: 'BAND KNIFE', company: 'SAN.V', model: 'SK-900', slNo: '0333418', idNo: 'A-S72', year: '2020' },
  { sno: 330, type: 'BAND KNIFE', company: 'SAN-V', model: 'SK.900', slNo: 'O333614', idNo: 'A-S73', year: '2020' },
  { sno: 331, type: 'END CUTTING MACHINE', company: 'DINO', model: 'DIN-108', slNo: '2411138039', idNo: 'A-S74', year: '2025' },
  { sno: 332, type: 'SINGEL BED FUSING', company: 'BHARATH', model: 'BSF66', slNo: '260709', idNo: 'A-S75', year: '2026' },
  { sno: 333, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0443', idNo: 'A-S76', year: '2024' },
  { sno: 334, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0440', idNo: 'A-S77', year: '2024' },
  { sno: 335, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0432', idNo: 'A-S78', year: '2024' },
  { sno: 336, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0455', idNo: 'A-S79', year: '2024' },
  { sno: 337, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0445', idNo: 'A-S80', year: '2024' },
  { sno: 338, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0441', idNo: 'A-S81', year: '2024' },
  { sno: 339, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0431', idNo: 'A-S82', year: '2024' },
  { sno: 340, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0448', idNo: 'A-S83', year: '2024' },
  { sno: 341, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0450', idNo: 'A-S84', year: '2024' },
  { sno: 342, type: 'THREAD TRIMMER', company: 'JOINSEW', model: 'JS-ST-1', slNo: 'TXY0436', idNo: 'A-S85', year: '2024' },
];

function mapType(rawType) {
  const t = (rawType || '').trim().toUpperCase();
  if (t.includes('OVER LOCK') || t.includes('OVERLOCK')) return 'OVERLOCK_4_THREAD';
  if (t.includes('FLAT LOCK') || t.includes('FLATLOCK') || t.includes('FLAT SEAMER')) return 'FLATLOCK_CYLINDER';
  if (t === 'SINGER') return 'SINGLE_NEEDLE';
  if (t.includes('DOUBLE NEEDLE')) return 'DOUBLE_NEEDLE';
  if (t.includes('BARTACK')) return 'BARTACK';
  if (t.includes('BUTTON') || t.includes('SNAP BUTTON')) return 'BUTTON_ATTACH';
  if (t.includes('KAJA')) return 'BUTTON_HOLE';
  if (t.includes('FUSING') || t.includes('FUSHING')) return 'FUSING_MACHINE';
  if (t.includes('KNIFE') || t.includes('CUTTING')) return 'BAND_KNIFE';
  return 'SINGLE_NEEDLE';
}

function mapDepartment(rawType) {
  const t = (rawType || '').trim().toUpperCase();
  if (t.includes('KNIFE') || t.includes('CUTTING') || t.includes('PATEN')) return 'Cutting Section';
  if (t.includes('FUSING') || t.includes('FUSHING')) return 'Fusing & Preparation';
  if (t.includes('TRIMMER') || t.includes('NEEDLE DETECTOR')) return 'Finishing Bay';
  return 'Sewing Floor';
}

function mapCategory(rawType) {
  const t = (rawType || '').trim().toUpperCase();
  if (t.includes('DETECTOR') || t.includes('WINDING')) return 'UTILITY';
  return 'MACHINE';
}

function mapCost(rawType, brand) {
  const t = (rawType || '').trim().toUpperCase();
  if (t.includes('FUSING')) return 120000;
  if (t.includes('KNIFE') || t.includes('PATEN')) return 180000;
  if (t.includes('FLAT LOCK') || t.includes('FLAT SEAMER')) return 85000;
  if (t.includes('OVER LOCK')) return 65000;
  if (t.includes('KAJA') || t.includes('BARTACK')) return 150000;
  return 48000;
}

function generateLine(index) {
  const lineNum = (index % 8) + 1;
  return `Line 0${lineNum}`;
}

function transformRowToMachine(row, index) {
  const yearNum = parseInt(row.year, 10) || 2020;
  const currentYear = 2026;
  const ageYears = Math.max(0, currentYear - yearNum);
  const purchaseDate = `${yearNum}-01-01`;
  const serial = row.slNo === 'NO NUMBER' || row.slNo === '-' ? `SN-${row.idNo}` : row.slNo;
  const cleanBrand = (row.company || 'STANDARD').toUpperCase();
  const cleanModel = row.model === '-' ? 'Standard' : row.model;
  const line = generateLine(index);
  const stationNo = `Station ${String((index % 24) + 1).padStart(2, '0')}`;

  return {
    id: row.idNo,
    name: `${cleanBrand} ${row.type} ${cleanModel}`,
    company: 'Esstee',
    companySlug: 'esstee',
    brand: cleanBrand,
    model: cleanModel,
    serialNo: serial,
    serialNumber: serial,
    mcNo: row.idNo,
    category: mapCategory(row.type),
    department: mapDepartment(row.type),
    machineClass: row.type.includes('OVER LOCK') ? 'OVERLOCK' : row.type.includes('FLAT LOCK') ? 'FLATLOCK' : 'SINGLE_NEEDLE',
    type: mapType(row.type),
    typeName: row.type,
    motorType: yearNum >= 2017 ? 'SERVO' : 'CLUTCH',
    purchaseDate: purchaseDate,
    year: yearNum,
    cost: mapCost(row.type, cleanBrand),
    status: 'ACTIVE',
    unit: 'UNIT - 1',
    area: 'HO',
    stationNo: serial,
    totalDowntimeMinutes: 0,
    ageYears: ageYears,
    specs: `HO Registry • S.No ${row.sno} • Make: ${cleanBrand} • Model: ${cleanModel} • S/N: ${serial} • Year: ${yearNum}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log(`=== Esstee Machine Seed Process ===`);
  console.log(`Parsed total raw rows from PDF: ${rawRows.length}`);

  if (rawRows.length !== 342) {
    console.error(`ERROR: Expected 342 rows, got ${rawRows.length}`);
    process.exit(1);
  }

  const machines = rawRows.map(transformRowToMachine);

  // 1. Write to src/data/plantAssetsSeed.json
  const seedPath = path.join(__dirname, '..', 'src', 'data', 'plantAssetsSeed.json');
  fs.writeFileSync(seedPath, JSON.stringify(machines, null, 2), 'utf-8');
  console.log(`Successfully wrote ${machines.length} machines to ${seedPath}`);

  // 2. Insert/Upsert into MongoDB compliance_esstee.machines
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(`Connected to MongoDB: ${uri}`);
    const db = client.db('compliance_esstee');
    const machinesCol = db.collection('machines');

    // Clean existing if any and bulk upsert
    console.log(`Updating compliance_esstee.machines...`);
    const bulkOps = machines.map((m) => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      },
    }));

    const result = await machinesCol.bulkWrite(bulkOps);
    console.log(`MongoDB BulkWrite result: Upserted=${result.upsertedCount}, Modified=${result.modifiedCount}, Matched=${result.matchedCount}`);

    const finalCount = await machinesCol.countDocuments();
    console.log(`Total verified machines in compliance_esstee: ${finalCount}`);

    // Verification summary
    const brands = {};
    const types = {};
    for (const m of machines) {
      brands[m.brand] = (brands[m.brand] || 0) + 1;
      types[m.typeName] = (types[m.typeName] || 0) + 1;
    }
    console.log('\nTop Brands in HO List:', brands);
    console.log('\nTypes Distribution:', types);

  } finally {
    await client.close();
    console.log(`MongoDB connection closed. Seeding complete!`);
  }
}

main().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
