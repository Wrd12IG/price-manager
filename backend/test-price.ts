import { ImportService } from './src/services/ImportService';
console.log("1.200,50 ->", ImportService.parseItalianPrice("1.200,50"));
console.log("1.200 ->", ImportService.parseItalianPrice("1.200"));
console.log("1.200.567,10 ->", ImportService.parseItalianPrice("1.200.567,10"));
console.log("1200,50 ->", ImportService.parseItalianPrice("1200,50"));
