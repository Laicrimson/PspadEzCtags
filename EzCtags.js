/**-----------------------------------------------------------------------------
 * Filename    : EzCtags.js
 * Last Modified  : 2016/02/03
 * Description    : Make PSPad to cooperate with ctags to provide with
 *                  going to definition.
 * Created        : 10 Apr 2009
 * Created by     : PoYang Lai ( Lai.crimson@gmail.com )
 * Tested with    : PSPad 2346 and above
-----------------------------------------------------------------------------**/

/**-----------------------------------------------------------------------------
 * Requirement  : 1. It needs ctags.exe and put ctags.exe in
 *                   PSPad\Script\JScript\Ezctags\ctags.exe
 *                2. Project should be opened.
 *                3. Configure "Project Default Directory" in Project setting
 *                   should be existed in project.
 *                4. tags file must be existed and created by EzCreateCtags.
-----------------------------------------------------------------------------**/

/**-----------------------------------------------------------------------------
 * Note      : Use EzGotoDefinition to goto the definition of
 *             macro/function/variable.
 *             Use OpenLogIndex to open matched one of definition.
 *
 *             Ctags file is named PROJECT_NAME.tag, which is made
 *             by ctags.exe.
 *
 *             EzCtags module will create ctags file accroding to project infomation,
 *             and stores them under .pspad in the same directory of project file.
 *             When execute EzGotoDefinition, it will list all
 *             matched definitions in the log windows.
 *             If only one definition is found, open this definition
 *             immediately. If more than one definition is found,
 *             then user needs to use OpenLogIndex to choose one
 *             in log windows to open.
-----------------------------------------------------------------------------**/

/**-----------------------------------------------------------------------------
 * Version History  :
 * 0.206                : 01/16/2017
 *                        Add CTAG HASH file support.
 * 0.205                : 02/03/2016
 *                        update: Remove EzCtags.exe support. Use Jscript to look up
 *                                definition in ctags file.
 *                        update: Clean up unused code.
 *                        new: support to get target name from clipboard and goto definition.
 *                        new: support ctags format=2, and show the definition type
 *                             in log window.
 * 0.204                : 08/06/2015
 *                        new: support parameters for ctags.
 *                        New funciton EzCtagsParameters created.
 * 0.203                : 08/02/2015
 *                        new: support project folder .pspad.
 * 0.202                : 06/05/2013
 *                        new: assume definition in current file is target one.
 * 0.201                : 06/07/2009
 *                        new: add EzResetTraceBack to reset trace back result
 * 0.200                : 07/05/2009
 *                        new: add definition trace back feature.
 * 0.100                : 12/04/2009
-----------------------------------------------------------------------------**/

/**
 * ctags.exe setting
 * user can specify ctags.exe in absoluted path
 * default: EzCtagsModulePath\ctags\ctags.exe by set CTAGS_EXE = null
 **/
var CTAGS_EXE = null;   // CTAGS_EXE = null means default

/**
 * Module infomation
 **/
var module_name = "EzCtags";
var module_version = "0.206";

/**
 * Shortcut setting.
 * user can modify shortcut here.
 **/
var gShortcutGotoDef = "CTRL+]";
var gShortcutGotoDefInClipboard = "CTRL+SHIFT+]";
var gShortcutDefTraceBack = "CTRL+[";
var gShortcutResetTraceBack = "CTRL+SHIFT+R";
//var gShortcutOpenIndex = "ALT+U";
var gShortcutOpenIndex = "";
var gShortcutCreateCtags = "CTRL+=";

/**
 * Max matched def setting.
 * In practice, it will burden the pspad when add too much lines to LOG window.
 * So, for performance consideration, it will stop searching when finding
 * too much matched def. And then user needs to input more precise keyword.
 **/
var TooMuchMatchedDef = 99;

/**
 *  Use selected text as target to find matched definition
 **/
var SelTextAsTarget = true;

/**
 *  Generate HASH file to speed up the defintion look up.
 **/
var GenerateCtagsHashFile = true;

/**
 * Output strings.
 * All warning strings are listed here.
 **/
var sNoProject = "\nNo Project...\n";
var sProjFileNotExist = "\nProject File is not existed...\n";
var sTooMuchMatchedDef = "\nToo Much Matched Definition...\n";
var sNoMatchDef = "\nNo Matched Definition\n";
var sIndexOutOfRange = "\nIndex Out Of Range...\n";
var sGetErrorLogLine = "\nGet Error Log Line...\n";
var sInputIndexPrompt = "\nPlease input an index number...\nZero to open all files...\n";
var sLogWindowIsNotReady = "\nLog Window Is Not Ready...\n";
var sCreateCtagsDialog = "\nDo you sure to create ctags for this project.\nIt will take seconds to do. (y/N)\n"
var sNoCtagsFile = "\nNo ctags file...\n";
var sNoTargetDef = "\nNo target definition...\n";
var sNoDefaultDir = "\nNo project default dir...\n";
var sFileNotExist = "\nFile is not existed...\n";
var sCtagsParametersPrompt = "\nCtags parameters configuration...\nThe default parameter for EzCtgas is\n  --sort=yes\n  --recurse=yes\n  --excmd=number\n  --format=2\nDon't override the defaults...\n";

/**
 * EzCtags magic string.
 * For identifying whether the content of LOG window is generated by EzCtags or not.
 **/
var sEzCtagsID = "All Matched Definition by EzCtags...";

/**-----------------------------------------------------------------------------
 * Programs
-----------------------------------------------------------------------------**/
//gloabl variables
var PSPAD_DIR = ".pspad";
var CTAGS_EXT_NAME = ".tag";
var HASH_EXT_NAME = ".hsh";
var DEFAULT_DIR_ID = "DefaultDir";

var CmdShell = CreateObject("WScript.Shell");
var FSObj = CreateObject("Scripting.FileSystemObject");

//global definition
var SelectTextFromEditor    = 1;
var SelectTextFromClipboard = 2;

function EzGotoDefinition() {
  EzGotoDefinitionHelper(SelectTextFromEditor);
}

function EzGotoDefInClipboard() {
  EzGotoDefinitionHelper(SelectTextFromClipboard);
}

function EzGotoDefinitionHelper(SelectTextMode)
{
  var ProjFilesCnt = projectFilesCount();
  var ProjName, CtagsName, HashName;
  var TargetName = null;
  var TargetNameLen = 0;
  var TargetDefCnt = 0;
  var CurrentEditObj = null;
  var Lines = null;
  var DefFileName, DefLineNum;
  var TextStream;
  var CurrentName = null;
  var CurrentFileDefFound = 0;
  var i = 0;
  var ProjPath;
  var PspadFolder;
  var HashLineNumber;

  if(ProjFilesCnt<=0){
    echo(sNoProject);
    return;
  }

  // get project filename
  ProjName = projectFileName();
  if(ProjName == null || ProjName == ""){
    echo(sProjFileNotExist);
    return;
  }

  // store current editor
  if(editorsCount()!=0){
    CurrentEditObj = newEditor();
    CurrentEditObj.assignActiveEditor();
  }else{
    echo(sNoTargetDef);
    return;
  }

  // Get current file name
  CurrentName = CurrentEditObj.fileName ();

  if(SelectTextMode == SelectTextFromEditor){
    // if select text in active editor, use select text as TargetName
    // else get the whole word at cursor.

    if(SelTextAsTarget && editorsCount()!=0){
      // get TargetName from select text
      TargetName = CurrentEditObj.selText();
    }
    if(TargetName == null || TargetName == ""){
      // use cursor location
      CurrentEditObj.command("ecSelWord");
      TargetName = CurrentEditObj.selText();
    }
  }
  if(SelectTextMode == SelectTextFromClipboard){
    TargetName=getClipboardText();
  }

  if(TargetName == null || TargetName == ""){
    return;
  }
  TargetNameLen = TargetName.length;

	var lastslash = ProjName.lastIndexOf("\\");
	ProjPath = ProjName.substring(0, lastslash+1);
  PspadFolder = ProjPath.concat(PSPAD_DIR);
  if(!FSObj.FolderExists(PspadFolder)){
    FSObj.CreateFolder(PspadFolder);
    var FolderObj = FSObj.GetFolder(PspadFolder);
    FolderObj.attributes |= 2;
  }
  // get ctags file name
  CtagsName = PspadFolder.concat("\\" + CTAGS_EXT_NAME);
  // get hashed file name
  HashName = PspadFolder.concat("\\" + HASH_EXT_NAME);

  if(!FSObj.FileExists(CtagsName)){
    echo(sNoCtagsFile);
    return;
  }

  // go to current editor before any actions
  if(CurrentEditObj){
    CurrentEditObj.activate();
  }

  // get hash line numer if hash file exists.
  HashLineNumber = 0;
  if(FSObj.FileExists(HashName)){
    var HashStream;
    // OpenTextFile(filename,
    //    1:ForReading 2:ForWriting 8:ForAppending,
    //    create,
    //    -2:TristateUseDefautl -1:TristateTrue 0:TristateFalse
    //    )
    HashStream = FSObj.OpenTextFile(HashName, 1, false, -2);
    while(!HashStream.AtEndOfStream){
      Lines = HashStream.ReadLine();
      if(Lines == null || Lines == "")
        continue;

      if(Lines.charAt(0) == TargetName.charAt(0)){
        var hash_format_str = Lines.split(" ");
        // parseInt(string, radix)
        HashLineNumber = parseInt(hash_format_str[1], 10);
      }
    }
    HashStream.Close();
  }

  // OpenTextFile(filename,
  //    1:ForReading 2:ForWriting 8:ForAppending,
  //    create,
  //    -2:TristateUseDefautl -1:TristateTrue 0:TristateFalse
  //    )
  TextStream = FSObj.OpenTextFile(CtagsName, 1, false, -2);

  while (TextStream.Line < HashLineNumber){
    if (!TextStream.AtEndOfStream) {
      TextStream.SkipLine();
    }
  }

  i = 1;
  while(!TextStream.AtEndOfStream){
    Lines = TextStream.ReadLine();
    if(Lines == null || Lines == "")
      continue;

    var sub_str = Lines.substr(0,TargetNameLen);
    if(sub_str < TargetName)
      continue;
    if(sub_str > TargetName)
      break;

    var ctags_format2_str = Lines.split(";\"");

    var tmpstr = ctags_format2_str[0].split("\t");
    if(tmpstr[0] != TargetName)
      continue;

    if(TargetDefCnt==0){
      logClear();
      // configure LOG window
      logSetTypeList();    // set log window type to List
      // set log parser string
      // click log window to open file
      logSetParser("* %F %L");
      logAddLine(sEzCtagsID +"    ( "+ TargetName+" )");  // EzOpenFiles Magic String
      // get def filename & def linenum
      DefFileName = tmpstr[1];
      DefLineNum = parseInt(tmpstr[2]);
    } else {
      if (CurrentName != null && CurrentName == tmpstr[1]) {
        CurrentFileDefFound = 1;
        DefFileName = tmpstr[1];
        DefLineNum = parseInt(tmpstr[2]);
      }
    }
    TargetDefCnt++;

    // construct output string
    var logStr = i.toString();
    i++;
    logStr = logStr.concat(" ");
    logStr = logStr.concat(tmpstr[1]);
    logStr = logStr.concat(" ");
    logStr = logStr.concat(tmpstr[2]);

    tmpstr = ctags_format2_str[1].split("\t");
    if(tmpstr[1] == null) ;
    else if(tmpstr[1] == "c") logStr = logStr.concat("    (CLASS NAME)");
    else if(tmpstr[1] == "d") logStr = logStr.concat("    (#DEFINE)");
    else if(tmpstr[1] == "e") logStr = logStr.concat("    (ENUMERATOR)");
    else if(tmpstr[1] == "f") logStr = logStr.concat("    (FUNCTION/METHOD)");
    else if(tmpstr[1] == "F") logStr = logStr.concat("    (FILE NAME)");
    else if(tmpstr[1] == "g") logStr = logStr.concat("    (ENUMERATION NAME)");
    else if(tmpstr[1] == "m") logStr = logStr.concat("    (MEMBER)");
    else if(tmpstr[1] == "p") logStr = logStr.concat("    (PROTOTYPE)");
    else if(tmpstr[1] == "s") logStr = logStr.concat("    (STRUCTURE NAME)");
    else if(tmpstr[1] == "t") logStr = logStr.concat("    (TYPEDEF)");
    else if(tmpstr[1] == "u") logStr = logStr.concat("    (UNION NAME)");
    else if(tmpstr[1] == "v") logStr = logStr.concat("    (VARIABLE)");

    logAddLine(logStr);    // list in log window

    // search too much files
    if(TargetDefCnt > TooMuchMatchedDef){
      echo(sTooMuchMatchedDef);
      break;
    }
  }
  TextStream.Close();

  // open or activate searched file
  if(TargetDefCnt == 1){
    runPSPadAction("aLogWindow");   // close log windows
    TraceGotoDef(1);                // add trace result
    OpenActivateFileAndGotoLineNo(DefFileName, DefLineNum, 0);
  }else if (CurrentFileDefFound == 1) {
    runPSPadAction("aLogWindow");   // close log windows
    TraceGotoDef(1);                // add trace result
    OpenActivateFileAndGotoLineNo(DefFileName, DefLineNum, 0);
  }else if(TargetDefCnt == 0){
    echo(sNoMatchDef);
  }
  return;
}

function GetHalfPageLines(ed)
{
  // get original position
  var orgX = ed.caretX();
  var orgY = ed.caretY();
  var lines = ed.linesCount();

  // verify lines in one page
  var top_line, btm_line, half_page;
  ed.command("ecPageTop");
  top_line = ed.caretY();
  ed.command("ecPageBottom");
  btm_line = ed.caretY();
  half_page = (btm_line - top_line - (btm_line-top_line)%2 )/2

  // reset cursor position
  ed.setCaretPos(orgX, orgY);

  return half_page;
}

function EzDefTraceBack()
{
  var Lines = TraceGotoDef(2);
  if(Lines == null)
    return;
  Lines = Lines.split("\t");
  OpenActivateFileAndGotoLineNo(Lines[0], parseInt(Lines[1]), parseInt(Lines[2]));
}

function EzResetTraceBack()
{
  TraceGotoDef(0);
}

function EzCreateHashFile(CtagsName, HashName)
{
  var TextStream;
  var HashStream;
  var Lines;
  var LineNumber;
  var FirstChar;

  if(!FSObj.FileExists(CtagsName)){
    echo(sNoCtagsFile);
    return;
  }

  // CreateTextFile(filename,
  //    overwrite,
  //    unicode
  //    )
  HashStream = FSObj.CreateTextFile(HashName, true, false);

  // OpenTextFile(filename,
  //    1:ForReading 2:ForWriting 8:ForAppending,
  //    create,
  //    -2:TristateUseDefautl -1:TristateTrue 0:TristateFalse
  //    )
  TextStream = FSObj.OpenTextFile(CtagsName, 1, false, -2);

  LineNumber = 0;
  FirstChar = 0;

  for(LineNumber = 0; !TextStream.AtEndOfStream; LineNumber++){
    Lines = TextStream.ReadLine();
    if(Lines == null || Lines == "")
      continue;

    if(FirstChar != Lines.charAt(0)){
      FirstChar = Lines.charAt(0);
      HashStream.WriteLine(FirstChar.toString() + " " + LineNumber);
    }
  }
  TextStream.Close();
  HashStream.Close();
}

function EzCreateCtags()
{
  var YesOrNo = inputText( sCreateCtagsDialog, null, null);
  if(YesOrNo.toLowerCase() != "y")
    return;

  var i;
  var ProjFilesCnt = projectFilesCount();
  var ProjName, CtagsName;
  var SrcPath;
  var CtagsExe, EzCtagsExe;
  var TextStream;
  var Lines;
  var editors_count = editorsCount();     // keeps this record
  var ProjPath;
  var PspadFolder;

  if(ProjFilesCnt<=0){
    echo(sNoProject);
    return;
  }

  // get project name
  ProjName = projectFileName();
  if(ProjName == null || ProjName == ""){
    echo(sProjFileNotExist);
    return;
  }

	var lastslash = ProjName.lastIndexOf("\\");
	ProjPath = ProjName.substring(0, lastslash+1);
  PspadFolder = ProjPath.concat(".pspad");
  if(!FSObj.FolderExists(PspadFolder)){
    FSObj.CreateFolder(PspadFolder);
    var FolderObj = FSObj.GetFolder(PspadFolder);
    FolderObj.attributes |= 2;
  }
  // get file name
  CtagsName = PspadFolder.concat("\\"+CTAGS_EXT_NAME);

  // get ctags.exe
  if(CTAGS_EXE != null && CTAGS_EXE != ""){
    CtagsExe = CTAGS_EXE;
  }else{
    CtagsExe = modulePath();
    CtagsExe = CtagsExe.concat("EzCtags\\ctags.exe");
  }

  // OpenTextFile(filename,
  //    1:ForReading 2:ForWriting 8:ForAppending,
  //    create,
  //    -2:TristateUseDefautl -1:TristateTrue 0:TristateFalse
  //    )
  TextStream = FSObj.OpenTextFile(ProjName, 1, true, -2);
  while(!TextStream.AtEndOfStream){
    Lines = TextStream.ReadLine();
    if(Lines.slice(0, DEFAULT_DIR_ID.length) == DEFAULT_DIR_ID){
      Lines = Lines.split("=");
      SrcPath = Lines[1];
      break;
    }
  }
  TextStream.Close();

  if(SrcPath == null || SrcPath == ""){
    echo(sNoDefaultDir);
    return;
  }

  // open config file
  var CustomizedConfig = "";
  var CtagsCfg = modulePath();
  CtagsCfg = CtagsCfg.concat("EzCtags\\Ctags.cfg");
  if(FSObj.FileExists(CtagsCfg)){
    var TextStream = FSObj.OpenTextFile(CtagsCfg, 1, false, -2);
  	if(!TextStream.AtEndOfStream){
      CustomizedConfig = TextStream.ReadLine();
    }
    TextStream.Close();
  }

  // run ctags main program to create CtagsName
  // sort=yes, recurse=yes, excmd=number, format=1
  CmdShell.Run("\""+CtagsExe+"\""+" -f "+"\""+CtagsName+"\""+ " " + CustomizedConfig + " --sort=yes --recurse=yes --excmd=number --format=2 "+"\""+SrcPath+"\"", 1, true);

  // generate hash file
  if (GenerateCtagsHashFile){
    var HashName;
    HashName = PspadFolder.concat("\\"+HASH_EXT_NAME);
    EzCreateHashFile(CtagsName, HashName);
  }

  return;
}

function EzOpenLogIndex()
{
  // nothing in LOG window
  if(logLinesCount()==0){
    echo(sLogWindowIsNotReady);
    return
  }

  var FileIndex = 0;
  var DefFileName, DefLineNum;

  var tmpStr = logGetLine(0);

  // identify log window
  if(tmpStr.slice(0, sEzCtagsID.length) != sEzCtagsID){
    echo(sLogWindowIsNotReady);
    return;
  }

  // get input index
  FileIndex = inputText( sInputIndexPrompt, 1, -1);

  // error input
  if(FileIndex == -1){
    return;
  }else if(FileIndex > logLinesCount()-1){
    echo(sIndexOutOfRange);
    return;
  }

  // open all files in LOG window
  if(FileIndex == 0){
    for(var i=1; i < logLinesCount(); i++){
      // get file & line# in LOG window
      tmpStr = logGetLine(i);
      if(tmpStr == null || tmpStr == ""){
        echo(sGetErrorLogLine);
        return;
      }
      tmpStr = tmpStr.split(" ");
      DefFileName = tmpStr[1];
      DefLineNum = tmpStr[2];
      // open or activate file
      OpenActivateFileAndGotoLineNo(DefFileName, DefLineNum, 0);
    }
  }else{
    // get file & line# in LOG window
    tmpStr = logGetLine(FileIndex);
    if(tmpStr == null || tmpStr == ""){
      echo(sGetErrorLogLine);
      return;
    }
    tmpStr = tmpStr.split(" ");
    DefFileName = tmpStr[1];
    DefLineNum = tmpStr[2];
    // add trace result
    TraceGotoDef(1);
    // open or activate file
    OpenActivateFileAndGotoLineNo(DefFileName, DefLineNum, 0);
  }
  // hide log windows after open file
  runPSPadAction("aLogWindow");

  return;
}

function OpenActivateFileAndGotoLineNo( file_name, line_num, column_num)
{
  var NewEditObj = newEditor(); //New editor object
  var i = FindOpenedFile(file_name);
  if(i == -1){
    if(FSObj.FileExists(file_name)){
      NewEditObj.openFile(file_name);
    }else{
      echo(sFileNotExist);
      return;
    }
  }else{
    NewEditObj.assignEditorByIndex(i);
  }
  NewEditObj.activate();

  if(line_num == null)
    return;
  // force result to editor center
  var halfpage;
  NewEditObj.setCaretPos(0, line_num);
  halfpage = GetHalfPageLines(NewEditObj);
  if((line_num-halfpage) <= 1) NewEditObj.setCaretPos(0, 1);
  else NewEditObj.setCaretPos(0, line_num-halfpage);
  if((line_num-(-halfpage)) >= NewEditObj.linesCount()) NewEditObj.setCaretPos(0, NewEditObj.linesCount());
  else NewEditObj.setCaretPos(0, line_num-(-halfpage));
  NewEditObj.setCaretPos(column_num, line_num);
  return;
}

function FindOpenedFile( file_name)
{
  var OpenedEditObj = newEditor();
  var i = 0;
  for(i=0; i< editorsCount(); i++){
    if(OpenedEditObj.assignEditorByIndex(i)){
      if(OpenedEditObj.filename() == file_name){
        return i;
      }
    }
  }
  return -1;
}

function TraceGotoDef(cmd)
{
  var TextStream;
  var TraceFileName = modulePath();
  TraceFileName = TraceFileName.concat("\\EzCtags\\EzCtags.trc");

  // clear trace result
  if(cmd == 0){
    if(FSObj.FileExists(TraceFileName)){
      FSObj.DeleteFile(TraceFileName, true);
    }
  // add trace result
  }else if(cmd == 1){
    if(editorsCount()==0)
      return;
    var CurrentEditObj;
    CurrentEditObj = newEditor();
    CurrentEditObj.assignActiveEditor();

    // OpenTextFile(filename,
    //    1:ForReading 2:ForWriting 8:ForAppending,
    //    create,
    //    -2:TristateUseDefautl -1:TristateTrue 0:TristateFalse
    //    )
    TextStream = FSObj.OpenTextFile(TraceFileName, 8, true, -2);
    TextStream.WriteLine(CurrentEditObj.fileName()+"\t"+CurrentEditObj.caretY()+"\t"+CurrentEditObj.caretX());
    TextStream.Close();
  // get and remove trace result
  }else if(cmd == 2){
    if(!FSObj.FileExists(TraceFileName))
      return null;
    var cnt = 0;
    var Lines = new Array();
    TextStream = FSObj.OpenTextFile(TraceFileName, 1, true, -2);
    while(!TextStream.AtEndOfStream){
      Lines[cnt] = TextStream.ReadLine();
      if(Lines[cnt]=="" || Lines[cnt]==null)
        continue;
      cnt++;
    }
    TextStream.Close();
    if(cnt == 0)
      return null;
    TextStream = FSObj.OpenTextFile(TraceFileName, 2, true, -2);
    for(var i=0;i<cnt-1;i++){
      TextStream.WriteLine(Lines[i]);
    }
    TextStream.Close();
    return Lines[cnt-1];
  }else{
    echo("\nUnsupported command...\n");
  }
}

function EzCtagsParameters()
{
  // get ctags.cfg
  var CtagsCfg = modulePath();
  CtagsCfg = CtagsCfg.concat("EzCtags\\ctags.cfg");
  var ConfigStr = "";
  if(FSObj.FileExists(CtagsCfg)){
    var TextStream = FSObj.OpenTextFile(CtagsCfg, 1, false, -2);
  	if(!TextStream.AtEndOfStream){
      ConfigStr = TextStream.ReadLine();
    }
    TextStream.Close();
  }

  ConfigStr = inputText(sCtagsParametersPrompt, ConfigStr, ConfigStr);
  if(ConfigStr == ""){
    // delete empty file
    if(FSObj.FileExists(CtagsCfg)){
      FSObj.DeleteFile(CtagsCfg, true);
    }
  }else{
    var TextStream = FSObj.OpenTextFile(CtagsCfg, 2, true, -2);
    TextStream.Write(ConfigStr);
    TextStream.Close()
  }
}

function OpenModule()
{
  try{
    OpenActivateFileAndGotoLineNo( moduleFileName(module_name), null, 0);
  }
  catch(e){
    echo("\nOpen file error...'\n" + moduleFileName(module_name) + "\n" + e.message + "\n");
  }
  return;
}

function Init()
{
  TraceGotoDef(0);  // clear trace result

  addMenuItem("Ez&GotoDefinition", "EzCtags", "EzGotoDefinition", gShortcutGotoDef);
	addMenuItem("EzGotoDefInClip&board", "EzCtags", "EzGotoDefInClipboard", gShortcutGotoDefInClipboard);
  addMenuItem("EzDef&TraceBack", "EzCtags", "EzDefTraceBack", gShortcutDefTraceBack);
  addMenuItem("Ez&ResetTraceBack", "EzCtags", "EzResetTraceBack", gShortcutResetTraceBack);
  addMenuItem("Ez&CreateCtags", "EzCtags", "EzCreateCtags", gShortcutCreateCtags);
  addMenuItem("EzOpenLog&Index", "EzCtags", "EzOpenLogIndex", gShortcutOpenIndex);
  addMenuItem("EzCtags&Parameters", "EzCtags", "EzCtagsParameters", "");
  addMenuItem("-", "EzCtags", "", "");
  addMenuItem("&EditEzCtags", "EzCtags", "OpenModule", "");
}
