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
    private var game: FamilyFeudGame
    
    init(game: FamilyFeudGame) {
        self.game = game
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
