//
//  LoadQuestionsViewModel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/3/23.
//

import FeudKit
import Foundation
import Observation
import SwiftUI

@Observable
class LoadQuestionsViewModel {
    private var windowcontroller: ManagementWindowController
    
    private var game: FamilyFeudGame
    
    public var viewstateservice: ViewStateService
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.game = game
        self.viewstateservice = viewstateservice
        self.windowcontroller = windowcontroller
    }
    
    func getQuestions() {
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
                
                _ = self.game.getState().executeAction(action: StateLoadQuestions.ACTION_LOADQUESTIONSET, data: fileContents)
            } catch {
                fatalError()
            }
        }
    }
}
