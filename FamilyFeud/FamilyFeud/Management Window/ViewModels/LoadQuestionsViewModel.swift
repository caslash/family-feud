//
//  LoadQuestionsViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/3/23.
//

import FeudKit
import Foundation
import SwiftUI

class LoadQuestionsViewModel: ObservableObject {
    @ObservedObject public var matchmanager: MatchManager
    @ObservedObject public var windowcontroller: ManagementWindowController
    @ObservedObject public var viewstateservice: ViewStateService
    
    init(matchmanager: MatchManager, windowcontroller: ManagementWindowController, viewstateservice: ViewStateService) {
        self.matchmanager = matchmanager
        self.windowcontroller = windowcontroller
        self.viewstateservice = viewstateservice
    }
    
    func getQuestions() {
        if let game = self.matchmanager.game {
            var fileContents: [String] = []
            
            let openPanel = NSOpenPanel()
            openPanel.allowedContentTypes = [.json]
            openPanel.allowsMultipleSelection = true
            openPanel.canChooseDirectories = false
            openPanel.canChooseFiles = true
            let response = openPanel.runModal()
            
            if (response == .OK) {
                do {
                    for url in openPanel.urls {
                        let contents = try String(contentsOf: url)
                        
                        fileContents.append(contents)
                    }
                    
                    _ = game.getState().executeAction(action: StateLoadQuestions.ACTION_LOADQUESTIONSET, data: fileContents)
                } catch {
                    fatalError()
                }
            }
        }
    }
}
